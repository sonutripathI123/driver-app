"""
TrackMyChauffeur connector — READ-ONLY.

The business runs a second, live operations app at trackmychauffeur.com that
holds the real driver roster (177+), vehicles, companies and bookings. This
connector signs in with the admin credentials from .env and only READS its JSON
API to pull data into this dashboard. It NEVER writes, changes or deletes
anything on trackmychauffeur.com — the only non-GET request it makes is the
login POST needed to obtain a session, exactly like a human signing in.

Phase 1 scope: import the driver roster into this app's `drivers` table so the
previously-empty roster is populated and jobs can be allocated here.

Safety rules baked in:
  * Only GET requests to data endpoints; the single POST is authentication.
  * Re-running the sync only CREATES drivers that are not here yet. Drivers
    already imported are LEFT UNTOUCHED, so any manual corrections made in this
    app (license number, email, phone, vehicle) are never overwritten.
  * Missing fields on the source (license, email, number plate) are filled with
    clearly-marked placeholders for the operator to edit later.
"""
import logging
import re
from typing import Dict, List, Optional, Tuple

import httpx
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.driver import Driver
from app.models.enums import DriverStatus

logger = logging.getLogger("tmc")

# Candidate login routes, tried in order. The app exposes a username/password
# admin sign-in; the exact path is confirmed at runtime by checking /api/user.
_LOGIN_PATHS = ["/api/login", "/api/auth/login", "/api/auth", "/api/session"]

# Marker written into a driver's notes so a re-sync can recognise an
# already-imported driver and skip it (never overwriting manual edits).
_TMC_ID_RE = re.compile(r"\[tmc-id:([0-9a-fA-F-]{6,})\]")


class TMCService:
    @staticmethod
    def configured() -> bool:
        return bool(
            (settings.TMC_BASE_URL or "").strip()
            and (settings.TMC_USERNAME or "").strip()
            and (settings.TMC_PASSWORD or "").strip()
        )

    # ---- HTTP (read-only except the login POST) --------------------------
    @staticmethod
    async def _authenticate(client: httpx.AsyncClient) -> None:
        """Establish a session on the TMC app. Raises on failure.

        The ONLY mutating request this connector ever makes is this login POST,
        which creates a session exactly as a human sign-in would. It changes no
        business data on trackmychauffeur.com.
        """
        username = settings.TMC_USERNAME.strip()
        password = settings.TMC_PASSWORD.strip()
        last_status = None

        for path in _LOGIN_PATHS:
            for payload in ({"username": username, "password": password},
                            {"email": username, "password": password}):
                try:
                    resp = await client.post(path, json=payload)
                except httpx.HTTPError as exc:
                    last_status = f"error {exc}"
                    continue
                last_status = resp.status_code
                if resp.status_code in (200, 201, 204):
                    # Confirm the session really works before trusting it.
                    who = await client.get("/api/user")
                    if who.status_code == 200:
                        try:
                            data = who.json()
                        except Exception:
                            data = None
                        if isinstance(data, dict) and (data.get("role") or data.get("id")):
                            logger.info("TMC login OK via %s (role=%s)", path, data.get("role"))
                            return
        raise RuntimeError(
            f"Could not sign in to TrackMyChauffeur (last response: {last_status}). "
            f"Check TMC_USERNAME / TMC_PASSWORD."
        )

    @staticmethod
    def _as_list(data) -> List[dict]:
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for key in ("data", "drivers", "vehicles", "items", "results"):
                if isinstance(data.get(key), list):
                    return data[key]
        return []

    @staticmethod
    async def _fetch(client: httpx.AsyncClient, path: str) -> List[dict]:
        resp = await client.get(path)
        resp.raise_for_status()
        return TMCService._as_list(resp.json())

    @staticmethod
    async def fetch_roster() -> Tuple[List[dict], Dict[str, dict]]:
        """Return (drivers, vehicles_by_id) from the live TMC app. Read-only."""
        base = settings.TMC_BASE_URL.strip().rstrip("/")
        async with httpx.AsyncClient(
            base_url=base, timeout=30.0, follow_redirects=True,
            headers={"Accept": "application/json"},
        ) as client:
            await TMCService._authenticate(client)
            drivers = await TMCService._fetch(client, "/api/drivers")
            try:
                vehicles = await TMCService._fetch(client, "/api/vehicles")
            except Exception as exc:  # vehicles are optional for Phase 1
                logger.warning("TMC vehicles fetch failed (continuing): %s", exc)
                vehicles = []
        veh_by_id = {str(v.get("id")): v for v in vehicles if v.get("id")}
        return drivers, veh_by_id

    # ---- Mapping helpers --------------------------------------------------
    @staticmethod
    def _vehicle_text(veh: Optional[dict]) -> str:
        if not veh:
            return "Not set"
        make = (veh.get("make") or "").strip()
        model = (veh.get("model") or "").strip()
        color = (veh.get("color") or "").strip()
        plate = (veh.get("licensePlate") or "").strip()
        name = " ".join(p for p in (color, make, model) if p).strip() or "Vehicle"
        return f"{name} ({plate})" if plate else name

    @staticmethod
    def _placeholder_email(tmc_id: str) -> str:
        return f"tmc-{tmc_id[:8]}@import.opalchauffeurs.com.au"

    # ---- Sync -------------------------------------------------------------
    @staticmethod
    async def sync_drivers(db: AsyncSession) -> dict:
        """Import TMC drivers into this app. Creates new ones only; leaves
        already-imported drivers untouched so manual edits are preserved."""
        if not TMCService.configured():
            raise RuntimeError("TrackMyChauffeur connector is not configured.")

        drivers, veh_by_id = await TMCService.fetch_roster()

        # Which TMC ids are already here? (parsed from existing notes)
        existing = (await db.execute(select(Driver))).scalars().all()
        known_ids = set()
        for d in existing:
            m = _TMC_ID_RE.search(d.notes or "")
            if m:
                known_ids.add(m.group(1).lower())

        skipped_existing = 0
        failed = 0
        errors: List[str] = []

        def _build(row: dict) -> Optional[Driver]:
            tmc_id = str(row.get("id") or "").strip()
            if not tmc_id or tmc_id.lower() in known_ids:
                return None
            name = (row.get("name") or "").strip() or "Unnamed Driver"
            phone = (row.get("phone") or "").strip() or "+61000000000"
            email = (row.get("email") or "").strip().lower()
            if not email or email == "—":
                email = TMCService._placeholder_email(tmc_id)
            veh = veh_by_id.get(str(row.get("vehicleId") or ""))
            veh_text = TMCService._vehicle_text(veh)
            username = (row.get("linkedUsername") or "").strip()
            # License is not held by TMC — use a unique, clearly-marked
            # placeholder (fits the 50-char column) the operator edits later.
            license_number = f"TMC-{tmc_id}".upper()[:50]
            note_bits = ["[TMC Import]", f"Vehicle: {veh_text}"]
            if username:
                note_bits.append(f"TMC user: {username}")
            note_bits.append("(license/email are placeholders — edit to correct)")
            note_bits.append(f"[tmc-id:{tmc_id}]")
            known_ids.add(tmc_id.lower())
            return Driver(
                full_name=name, phone=phone, email=email,
                license_number=license_number, status=DriverStatus.AVAILABLE,
                rating=5.0, is_active=True, notes=" | ".join(note_bits),
            )

        to_create = [d for d in (_build(r) for r in drivers) if d is not None]
        skipped_existing = len(drivers) - len(to_create)

        # One bulk insert (fast — a single round trip) with a per-row fallback
        # only if the batch hits an unexpected constraint, so one bad row can't
        # lose the whole import.
        created = 0
        if to_create:
            db.add_all(to_create)
            try:
                await db.commit()
                created = len(to_create)
            except IntegrityError:
                await db.rollback()
                created = 0
                for driver in to_create:
                    try:
                        async with db.begin_nested():
                            db.add(driver)
                        created += 1
                    except Exception as exc:
                        failed += 1
                        if len(errors) < 10:
                            errors.append(f"{driver.full_name}: {getattr(exc, 'orig', exc)}")
                await db.commit()
        logger.info(
            "TMC sync: %d created, %d already here, %d failed (of %d fetched)",
            created, skipped_existing, failed, len(drivers),
        )
        return {
            "fetched": len(drivers),
            "created": created,
            "skipped_existing": skipped_existing,
            "failed": failed,
            "errors": errors,
        }
