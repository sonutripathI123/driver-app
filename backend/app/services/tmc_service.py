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
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import httpx

try:
    from zoneinfo import ZoneInfo
    _MEL = ZoneInfo("Australia/Melbourne")
except Exception:  # pragma: no cover
    _MEL = timezone.utc
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.driver import Driver
from app.models.enums import DriverStatus, VehicleCategory
from app.models.vehicle import Vehicle

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

    @staticmethod
    async def fetch_active_locations() -> List[dict]:
        """Live driver GPS positions from TMC (read-only). Normalised to a flat
        list of {driver_id, name, lat, lng, heading, updated_at}. Empty when no
        driver is currently sharing a location (e.g. no active trips)."""
        base = settings.TMC_BASE_URL.strip().rstrip("/")
        async with httpx.AsyncClient(
            base_url=base, timeout=30.0, follow_redirects=True,
            headers={"Accept": "application/json"},
        ) as client:
            await TMCService._authenticate(client)
            raw = await TMCService._fetch(client, "/api/locations/active")

        def _num(*vals):
            for v in vals:
                if v is None:
                    continue
                try:
                    return float(v)
                except (TypeError, ValueError):
                    continue
            return None

        out: List[dict] = []
        for r in raw:
            if not isinstance(r, dict):
                continue
            lat = _num(r.get("lat"), r.get("latitude"), r.get("Lat"))
            lng = _num(r.get("lng"), r.get("longitude"), r.get("lon"), r.get("lng_"))
            if lat is None or lng is None:
                continue
            out.append({
                "driver_id": r.get("driverId") or r.get("driver_id") or r.get("id"),
                "name": r.get("name") or r.get("driverName") or r.get("driver_name") or "Driver",
                "lat": lat,
                "lng": lng,
                "heading": r.get("heading") or r.get("bearing"),
                "updated_at": r.get("updatedAt") or r.get("timestamp") or r.get("updated_at"),
                "booking": r.get("bookingRef") or r.get("booking") or None,
            })
        return out

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

    @staticmethod
    def _infer_category(veh: dict) -> VehicleCategory:
        """Best-effort map of a free-text TMC vehicle to this app's category.

        TMC stores vehicles as free text (make/model/colour), with no class, so
        the dispatch vehicle-match needs a category guessed from the words. The
        operator can correct any vehicle later under the fleet.
        """
        text = f"{veh.get('make', '')} {veh.get('model', '')}".lower()
        if any(w in text for w in ("sprinter", "minibus", "coaster", "bus")):
            return VehicleCategory.MINIBUS
        if any(w in text for w in ("v-class", "vclass", "v class", "viano", "valente",
                                   "van", "carnival", "people", "mover", "staria", "multivan")):
            return VehicleCategory.PEOPLE_MOVER
        if any(w in text for w in ("suv", "q7", "q8", "x5", "x7", "gle", "gls", "prado",
                                   "landcruiser", "land cruiser", "lx", "gx", "rx", "cayenne",
                                   "range rover", "discovery", "defender", "4wd")):
            return VehicleCategory.SUV_PREMIUM
        if any(w in text for w in ("s class", "s-class", "sclass", "7 series", "7series",
                                   "a8", "ls", "maybach", "ls500")):
            return VehicleCategory.SEDAN_PREMIUM
        # Default: an executive sedan (E-Class, 5 Series, Camry, Lexus sedan, …).
        return VehicleCategory.SEDAN_EXECUTIVE

    @staticmethod
    def _norm_plate(plate: Optional[str]) -> str:
        return re.sub(r"\s+", "", (plate or "").strip()).upper()

    # ---- Sync -------------------------------------------------------------
    @staticmethod
    async def _ensure_vehicles(db: AsyncSession, veh_by_id: Dict[str, dict],
                               errors: List[str]) -> Tuple[Dict[str, str], int]:
        """Ensure a fleet Vehicle exists for each TMC vehicle (deduped by plate).

        Returns (tmc_vehicle_id -> app vehicle id, created_count). TMC plates are
        often duplicated or junk, so plates are normalised, reused when already
        present, and replaced with a unique placeholder when missing/junk (the
        column is unique). Category is guessed; year is a placeholder to edit.
        """
        existing = (await db.execute(select(Vehicle))).scalars().all()
        plate_to_id: Dict[str, str] = {v.registration_plate.upper(): v.id for v in existing}
        tmcveh_to_appid: Dict[str, str] = {}
        created = 0

        for tmc_vid, tv in veh_by_id.items():
            make = (tv.get("make") or "").strip() or "Unknown"
            model = (tv.get("model") or "").strip() or "Vehicle"
            plate = TMCService._norm_plate(tv.get("licensePlate"))
            junk = (
                not plate
                or not re.search(r"[A-Z0-9]", plate)
                or plate == TMCService._norm_plate(f"{make} {model}")
            )
            if junk:
                plate = f"TMC-{tmc_vid[:8]}".upper()
            plate = plate[:20]

            if plate in plate_to_id:
                tmcveh_to_appid[tmc_vid] = plate_to_id[plate]
                continue

            veh = Vehicle(
                category=TMCService._infer_category(tv),
                make=make[:100],
                model=model[:100],
                year=2020,  # TMC holds no year — placeholder for the operator.
                color=((tv.get("color") or "").strip() or None),
                registration_plate=plate,
                is_active=True,
            )
            try:
                async with db.begin_nested():
                    db.add(veh)
                    await db.flush()
                plate_to_id[plate] = veh.id
                tmcveh_to_appid[tmc_vid] = veh.id
                created += 1
            except Exception as exc:
                if len(errors) < 10:
                    errors.append(f"vehicle {plate}: {getattr(exc, 'orig', exc)}")
        await db.commit()
        return tmcveh_to_appid, created

    @staticmethod
    async def sync_drivers(db: AsyncSession) -> dict:
        """Import TMC drivers + their vehicles into this app.

        - Creates fleet vehicles and links each driver to their fixed vehicle.
        - Creates drivers not here yet; existing imports keep their fields
          untouched (manual edits preserved) but DO get their vehicle linked if
          they have none yet (additive only).
        """
        if not TMCService.configured():
            raise RuntimeError("TrackMyChauffeur connector is not configured.")

        drivers, veh_by_id = await TMCService.fetch_roster()
        errors: List[str] = []

        # Map every TMC vehicle to a fleet vehicle first, so drivers can link.
        tmcveh_to_appid, vehicles_created = await TMCService._ensure_vehicles(db, veh_by_id, errors)

        # Existing imported drivers, keyed by their TMC id (parsed from notes).
        existing = (await db.execute(select(Driver))).scalars().all()
        drivers_by_tmcid: Dict[str, Driver] = {}
        for d in existing:
            m = _TMC_ID_RE.search(d.notes or "")
            if m:
                drivers_by_tmcid[m.group(1).lower()] = d
        known_ids = set(drivers_by_tmcid.keys())

        to_create: List[Driver] = []
        skipped_existing = 0
        linked_existing = 0
        failed = 0

        for row in drivers:
            tmc_id = str(row.get("id") or "").strip()
            if not tmc_id:
                failed += 1
                continue
            key = tmc_id.lower()
            app_vehicle_id = tmcveh_to_appid.get(str(row.get("vehicleId") or ""))

            if key in known_ids:
                skipped_existing += 1
                drv = drivers_by_tmcid.get(key)
                # Link a vehicle only when the driver has none — never override a
                # vehicle the operator may have assigned by hand.
                if drv is not None and not drv.default_vehicle_id and app_vehicle_id:
                    drv.default_vehicle_id = app_vehicle_id
                    linked_existing += 1
                continue

            name = (row.get("name") or "").strip() or "Unnamed Driver"
            phone = (row.get("phone") or "").strip() or "+61000000000"
            email = (row.get("email") or "").strip().lower()
            if not email or email == "—":
                email = TMCService._placeholder_email(tmc_id)
            veh_text = TMCService._vehicle_text(veh_by_id.get(str(row.get("vehicleId") or "")))
            username = (row.get("linkedUsername") or "").strip()
            license_number = f"TMC-{tmc_id}".upper()[:50]
            note_bits = ["[TMC Import]", f"Vehicle: {veh_text}"]
            if username:
                note_bits.append(f"TMC user: {username}")
            note_bits.append("(license/email are placeholders — edit to correct)")
            note_bits.append(f"[tmc-id:{tmc_id}]")
            to_create.append(Driver(
                full_name=name, phone=phone, email=email,
                license_number=license_number, status=DriverStatus.AVAILABLE,
                rating=5.0, is_active=True, notes=" | ".join(note_bits),
                default_vehicle_id=app_vehicle_id,
            ))
            known_ids.add(key)

        # Persist the vehicle links on existing drivers first, so a later
        # per-row fallback on the new-driver insert can't roll them back.
        await db.commit()

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
            "TMC sync: %d drivers created, %d linked, %d already here, %d vehicles created, %d failed (of %d)",
            created, linked_existing, skipped_existing, vehicles_created, failed, len(drivers),
        )
        return {
            "fetched": len(drivers),
            "created": created,
            "skipped_existing": skipped_existing,
            "linked_existing": linked_existing,
            "vehicles_created": vehicles_created,
            "failed": failed,
            "errors": errors,
        }

    # ---- Bookings (Phase 3) ----------------------------------------------
    @staticmethod
    def _parse_tmc_time(s: Optional[str]) -> Optional[datetime]:
        """Parse TMC's 'October 24th, 2026 10:30 AM' into a UTC datetime.

        TMC shows Melbourne local time with an ordinal day; localise it to
        Melbourne and convert to UTC for storage/comparison.
        """
        if not s:
            return None
        txt = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", str(s)).strip()
        for fmt in ("%B %d, %Y %I:%M %p", "%B %d, %Y %H:%M", "%b %d, %Y %I:%M %p"):
            try:
                naive = datetime.strptime(txt, fmt)
                return naive.replace(tzinfo=_MEL).astimezone(timezone.utc)
            except ValueError:
                continue
        return None

    @staticmethod
    def _digits(phone: Optional[str]) -> str:
        d = re.sub(r"\D", "", phone or "")
        return d[-9:] if len(d) >= 9 else d

    @staticmethod
    async def sync_bookings(db: AsyncSession, days_back: int = 1, days_ahead: int = 120) -> dict:
        """Import UPCOMING non-Zoho TMC bookings as dispatch-ready DRAFT bookings.

        Dedup is layered so nothing doubles up:
          * Zoho-origin TMC rows are skipped — this app already imports those
            straight from the Zoho calendar.
          * Rows already imported from TMC before are skipped (marker in notes).
          * A row matching an existing booking by phone + pickup time (±90 min)
            is skipped.
        All automated reminders are suppressed (no SMS), exactly like the Zoho
        import. Read-only against TMC.
        """
        from sqlalchemy import select
        from app.models.booking import Booking
        from app.models.booking_leg import BookingLeg
        from app.models.customer import Customer
        from app.models.enums import BookingSource
        from app.schemas.booking import BookingCreate, BookingLegCreate
        from app.services.booking_service import BookingService

        if not TMCService.configured():
            raise RuntimeError("TrackMyChauffeur connector is not configured.")

        base = settings.TMC_BASE_URL.strip().rstrip("/")
        async with httpx.AsyncClient(
            base_url=base, timeout=40.0, follow_redirects=True,
            headers={"Accept": "application/json"},
        ) as client:
            await TMCService._authenticate(client)
            rows = await TMCService._fetch(client, "/api/bookings")

        now = datetime.now(timezone.utc)
        window_start = now - timedelta(days=days_back)
        window_end = now + timedelta(days=days_ahead)

        # Existing state for dedupe.
        existing = (await db.execute(select(Booking))).scalars().all()
        known_tmc = set()
        for b in existing:
            m = re.search(r"\[tmc-booking-id:([0-9a-fA-F-]{6,})\]", b.internal_notes or "")
            if m:
                known_tmc.add(m.group(1).lower())

        leg_rows = (await db.execute(
            select(Customer.phone, Booking.passenger_phone, BookingLeg.pickup_datetime)
            .select_from(Booking)
            .join(BookingLeg, BookingLeg.booking_id == Booking.id)
            .join(Customer, Customer.id == Booking.customer_id, isouter=True)
        )).all()
        phone_times: Dict[str, List[datetime]] = {}
        for cust_phone, pax_phone, pdt in leg_rows:
            if pdt is None:
                continue
            pdt = pdt if pdt.tzinfo else pdt.replace(tzinfo=timezone.utc)
            for ph in (cust_phone, pax_phone):
                key = TMCService._digits(ph)
                if key:
                    phone_times.setdefault(key, []).append(pdt)

        created = skipped_zoho = skipped_existing = skipped_dupe = skipped_past = failed = 0
        errors: List[str] = []

        for row in rows:
            tmc_id = str(row.get("id") or "").strip()
            if not tmc_id:
                failed += 1
                continue
            if tmc_id.lower() in known_tmc:
                skipped_existing += 1
                continue

            pickup_loc = (row.get("pickupLocation") or "").strip()
            if "zoho" in pickup_loc.lower():
                skipped_zoho += 1
                continue

            when = TMCService._parse_tmc_time(row.get("pickupTime"))
            if not when or not (window_start <= when <= window_end):
                skipped_past += 1
                continue

            phone = (row.get("customerPhone") or "").strip()
            pkey = TMCService._digits(phone)
            if pkey and any(abs((t - when).total_seconds()) <= 5400 for t in phone_times.get(pkey, [])):
                skipped_dupe += 1
                continue

            name = (row.get("customerName") or "TMC booking").strip()[:120] or "TMC booking"
            email = (row.get("customerEmail") or "").strip() or None
            dropoff = (row.get("dropoffLocation") or "").strip()
            flight = (row.get("flightNumber") or "").strip() or None
            extra = (row.get("extra") or "").strip()
            bref = (row.get("providerBookingRef") or "").strip()

            def _norm_addr(a: str, fallback: str) -> str:
                a = (a or "").strip()
                if len(a) < 3:
                    a = fallback
                return a[:500]

            pickup = _norm_addr(pickup_loc, "See booking notes")
            dropoff = _norm_addr(dropoff, "See booking notes")

            veh_text = ""
            mveh = re.search(r"vehicle\s*:\s*([^\n|]+)", extra, re.I)
            if mveh:
                veh_text = mveh.group(1).strip()
            category = TMCService._infer_category({"make": veh_text, "model": ""}) if veh_text and "next available" not in veh_text.lower() else None

            is_airport = "airport" in pickup.lower() or bool(flight)
            note_bits = ["[TMC Booking]"]
            if bref:
                note_bits.append(f"Ref: {bref}")
            if extra:
                note_bits.append(f"| {extra}")
            if row.get("driverId"):
                note_bits.append(f"| TMC driver id: {row.get('driverId')}")
            note_bits.append(f"[tmc-booking-id:{tmc_id}]")

            leg_kwargs = dict(
                leg_number=1,
                pickup_address=pickup,
                dropoff_address=dropoff,
                pickup_datetime=when,
                is_airport_pickup=is_airport,
                flight_number=(flight[:20] if flight else None),
            )
            if category is not None:
                leg_kwargs["vehicle_category"] = category

            try:
                booking_in = BookingCreate(
                    customer_name=name,
                    customer_email=email or "tmc-import@opalchauffeurs.com.au",
                    customer_phone=phone or "+61000000000",
                    source=BookingSource.WEBSITE,
                    total_fare=0.0,
                    deposit_percentage=100.0,
                    flight_tracking_enabled=bool(flight),
                    passenger_name=name,
                    passenger_phone=phone or None,
                    passenger_email=email,
                    passenger_count=1,
                    luggage_count=0,
                    internal_notes=" ".join(note_bits)[:4000],
                    legs=[BookingLegCreate(**leg_kwargs)],
                )
                booking = await BookingService.create_booking(db, booking_in, notify=False)
                booking.driver_handover_sent = True
                booking.customer_reminder_12_24h_sent = True
                await db.commit()
                created += 1
                known_tmc.add(tmc_id.lower())
                if pkey:
                    phone_times.setdefault(pkey, []).append(when)
            except Exception as exc:
                await db.rollback()
                failed += 1
                if len(errors) < 10:
                    errors.append(f"{name}: {exc}")

        logger.info(
            "TMC bookings sync: %d created, %d existing, %d zoho-skip, %d dupe, %d out-of-window, %d failed (of %d)",
            created, skipped_existing, skipped_zoho, skipped_dupe, skipped_past, failed, len(rows),
        )
        return {
            "fetched": len(rows),
            "created": created,
            "skipped_existing": skipped_existing,
            "skipped_zoho": skipped_zoho,
            "skipped_duplicate": skipped_dupe,
            "skipped_out_of_window": skipped_past,
            "failed": failed,
            "errors": errors,
        }
