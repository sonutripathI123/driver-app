"""
Read the business' Zoho Calendar (all booking channels) from its private iCal
feed and expose the events to the dashboard.

Nothing is made public: the feed URL is a private, resettable token kept in
ZOHO_ICAL_URL. The full feed (thousands of events) is fetched, parsed and cached
in memory for a few minutes; callers ask for a date range and get just that
slice. Times are converted to Australia/Melbourne so the day grouping matches
what the operator sees in Zoho.
"""
import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger("zoho_calendar")

try:
    from zoneinfo import ZoneInfo
    _MEL = ZoneInfo("Australia/Melbourne")
except Exception:  # pragma: no cover
    _MEL = timezone.utc

# Module-level cache: {"at": epoch, "events": [...]}
_cache: Dict[str, object] = {"at": 0.0, "events": None}

# Serialise sync runs within this process so a manual sync and the cron sync
# cannot race on booking-number generation.
_sync_lock = asyncio.Lock()


class ZohoCalendarService:
    @staticmethod
    def configured() -> bool:
        return bool((settings.ZOHO_ICAL_URL or "").strip())

    @staticmethod
    def _unfold(text: str) -> List[str]:
        """Undo iCal line folding (continuation lines start with space/tab)."""
        lines: List[str] = []
        for raw in text.splitlines():
            if raw[:1] in (" ", "\t") and lines:
                lines[-1] += raw[1:]
            else:
                lines.append(raw)
        return lines

    @staticmethod
    def _unescape(v: str) -> str:
        return (v.replace("\\,", ",").replace("\\;", ";")
                 .replace("\\n", " ").replace("\\N", " ").strip())

    @staticmethod
    def _parse_dt(value: str, is_date: bool) -> Optional[tuple]:
        """Return (date 'YYYY-MM-DD', time 'h:mm am', iso, all_day) in Melbourne."""
        v = (value or "").strip()
        if not v:
            return None
        # All-day / date-only (YYYYMMDD)
        if is_date or (len(v) == 8 and v.isdigit()):
            try:
                d = datetime.strptime(v[:8], "%Y%m%d")
            except ValueError:
                return None
            ds = d.strftime("%Y-%m-%d")
            return (ds, "", ds, True)
        # Date-time
        try:
            if v.endswith("Z"):
                dt = datetime.strptime(v[:15], "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc)
                local = dt.astimezone(_MEL)
            else:
                # Floating or TZID-qualified: treat the wall time as local.
                local = datetime.strptime(v[:15], "%Y%m%dT%H%M%S")
        except ValueError:
            return None
        return (
            local.strftime("%Y-%m-%d"),
            local.strftime("%I:%M %p").lstrip("0").lower(),
            local.isoformat(),
            False,
        )

    @staticmethod
    def _parse_description(desc: str) -> Dict[str, Optional[str]]:
        """Pull structured booking fields out of a Zoho event description.
        Formats vary by source, so this is best-effort and label-driven."""
        import re
        out: Dict[str, Optional[str]] = {
            "pickup": None, "dropoff": None, "phone": None,
            "email": None, "vehicle": None, "flight": None, "name": None,
        }
        if not desc:
            return out
        text = (desc.replace("\\n", "\n").replace("\\N", "\n")
                    .replace("\\,", ",").replace("\\;", ";").replace("\\\\", "\\"))

        def label(pattern: str) -> Optional[str]:
            m = re.search(rf"{pattern}\s*[:\-]\s*(.+)", text, re.IGNORECASE)
            return m.group(1).strip() if m else None

        out["pickup"] = label(r"pick\s*-?\s*up")
        out["dropoff"] = label(r"drop\s*-?\s*off")
        out["vehicle"] = label(r"vehicle")
        out["name"] = label(r"name")
        out["flight"] = label(r"arriving flight") or label(r"flight")
        em = re.search(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", text)
        out["email"] = em.group(0).strip() if em else None
        ph = label(r"contact") or label(r"phone") or label(r"mobile")
        if not ph:
            pm = re.search(r"(\+?\d[\d\s\-]{7,}\d)", text)
            ph = pm.group(1).strip() if pm else None
        out["phone"] = ph
        return out

    @staticmethod
    def _parse_ics(text: str) -> List[Dict]:
        events: List[Dict] = []
        cur: Optional[Dict] = None
        for line in ZohoCalendarService._unfold(text):
            if line.startswith("BEGIN:VEVENT"):
                cur = {}
            elif line.startswith("END:VEVENT"):
                if cur is not None:
                    events.append(cur)
                cur = None
            elif cur is not None and ":" in line:
                name_part, _, val = line.partition(":")
                name = name_part.split(";")[0].upper()
                is_date = "VALUE=DATE" in name_part.upper()
                if name == "SUMMARY":
                    cur["title"] = ZohoCalendarService._unescape(val)
                elif name == "DESCRIPTION":
                    cur["_desc"] = val  # unescaped later in _parse_description
                elif name == "LOCATION":
                    cur["location"] = ZohoCalendarService._unescape(val)
                elif name == "DTSTART":
                    p = ZohoCalendarService._parse_dt(val, is_date)
                    if p:
                        cur["_start"] = p
                elif name == "DTEND":
                    p = ZohoCalendarService._parse_dt(val, is_date)
                    if p:
                        cur["_end"] = p
                elif name == "UID":
                    cur["uid"] = val.strip()

        out: List[Dict] = []
        for e in events:
            s = e.get("_start")
            if not s:
                continue
            d = ZohoCalendarService._parse_description(e.get("_desc") or "")
            out.append({
                "uid": e.get("uid"),
                "title": e.get("title") or "(no title)",
                "location": e.get("location") or "",
                "date": s[0],
                "time": s[1],
                "start": s[2],
                "all_day": s[3],
                "pickup": d["pickup"],
                "dropoff": d["dropoff"],
                "phone": d["phone"],
                "email": d["email"],
                "vehicle": d["vehicle"],
                "flight": d["flight"],
                "name": d["name"],
            })
        return out

    @staticmethod
    async def _all_events(force: bool = False) -> List[Dict]:
        ttl = settings.ZOHO_ICAL_CACHE_SECONDS or 300
        now = time.time()
        cached = _cache.get("events")
        if not force and cached is not None and (now - float(_cache.get("at", 0))) < ttl:
            return cached  # type: ignore[return-value]
        url = (settings.ZOHO_ICAL_URL or "").strip()
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            res = await client.get(url)
            res.raise_for_status()
            text = res.text
        evs = ZohoCalendarService._parse_ics(text)
        _cache["events"] = evs
        _cache["at"] = now
        logger.info("Zoho iCal: parsed %d events", len(evs))
        return evs

    @staticmethod
    async def events_in_range(start: str, end: str) -> List[Dict]:
        """start/end are 'YYYY-MM-DD' inclusive (Melbourne day)."""
        evs = await ZohoCalendarService._all_events()
        res = [e for e in evs if start <= e["date"] <= end]
        res.sort(key=lambda e: (e["date"], e["start"]))
        return res

    # ------------------------------------------------------------------ dispatch sync

    @staticmethod
    def _guess_vehicle(title: str):
        from app.models.enums import VehicleCategory
        t = (title or "").lower()
        if any(k in t for k in ("mini van", "minivan", "people mover", "van", "mpv")):
            return VehicleCategory.PEOPLE_MOVER
        if "suv" in t:
            return VehicleCategory.SUV_PREMIUM
        if "luxury" in t or "first class" in t or "s class" in t or "s-class" in t:
            return VehicleCategory.SEDAN_EXECUTIVE
        return VehicleCategory.SEDAN_PREMIUM

    @staticmethod
    def _route_from_title(title: str):
        """Pull 'X to Y' out of the last (...) group in the title."""
        import re
        pickup = dropoff = None
        groups = re.findall(r"\(([^()]*)\)", title or "")
        if groups:
            inner = groups[-1]
            m = re.split(r"\s+to\s+", inner, maxsplit=1, flags=re.IGNORECASE)
            if len(m) == 2:
                pickup, dropoff = m[0].strip(), m[1].strip()
        return pickup, dropoff

    @staticmethod
    async def sync_upcoming_to_bookings(db, days_back: int = 1, days_ahead: int = 14) -> Dict[str, int]:
        """Create DRAFT, dispatchable bookings on the Operate Board from upcoming
        Zoho calendar jobs. Idempotent per event UID. Skips cancelled / do-not-
        dispatch jobs. Returns {created, skipped}."""
        import re
        from datetime import datetime, timedelta
        from sqlalchemy import select
        from app.models.booking import Booking
        from app.models.enums import BookingSource, VehicleCategory
        from app.schemas.booking import BookingCreate, BookingLegCreate
        from app.services.booking_service import BookingService

        if not ZohoCalendarService.configured():
            return {"created": 0, "skipped": 0}

        today_mel = datetime.now(_MEL).date()
        start = (today_mel - timedelta(days=days_back)).strftime("%Y-%m-%d")
        end = (today_mel + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
        events = await ZohoCalendarService.events_in_range(start, end)

        created = skipped = 0
        for e in events:
            title = (e.get("title") or "").strip()
            uid = (e.get("uid") or "").strip()
            tl = title.lower()
            if not uid or not title:
                skipped += 1
                continue
            # Skip cancelled / explicitly not-for-dispatch jobs.
            if any(k in tl for k in ("cancel", "donotdispatch", "do not dispatch", "do-not-dispatch")):
                skipped += 1
                continue

            tag = f"[zoho-uid:{uid}]"
            exists = (
                await db.execute(select(Booking.id).where(Booking.internal_notes.ilike(f"%{tag}%")))
            ).first()
            if exists:
                skipped += 1
                continue

            try:
                when = datetime.fromisoformat(e["start"])
            except Exception:
                skipped += 1
                continue

            def _norm_addr(a: Optional[str]) -> str:
                a = (a or "").strip()
                if a.upper() == "AP":
                    return "Airport (AP)"
                if len(a) < 3:
                    a = f"{a} — see job title".strip()
                return a[:500]

            pickup_raw, dropoff_raw = ZohoCalendarService._route_from_title(title)
            pickup = _norm_addr(pickup_raw or "See job title")
            dropoff = _norm_addr(dropoff_raw or "See job title")
            is_airport = ("airport" in tl) or bool(re.search(r"\bap\b", tl))

            try:
                booking_in = BookingCreate(
                    customer_name=title[:120],
                    # No contact details come from the calendar; attach all imports
                    # to one pseudo-customer so dispatch works. The real job label
                    # is the passenger_name / notes.
                    customer_email="calendar-import@opalchauffeurs.com.au",
                    customer_phone="+61000000000",
                    source=BookingSource.WEBSITE,
                    total_fare=0.0,
                    deposit_percentage=100.0,
                    passenger_name=title[:120],
                    passenger_count=1,
                    luggage_count=0,
                    internal_notes=f"[Zoho Calendar] {title} {tag}"[:4000],
                    legs=[BookingLegCreate(
                        leg_number=1,
                        pickup_address=pickup,
                        dropoff_address=dropoff,
                        pickup_datetime=when,
                        vehicle_category=ZohoCalendarService._guess_vehicle(title),
                        is_airport_pickup=is_airport,
                    )],
                )
                await BookingService.create_booking(db, booking_in, notify=False)
                created += 1
            except Exception as exc:
                logger.warning("Zoho->booking create failed for %s: %s", uid, exc)
                skipped += 1

        if created:
            logger.info("Zoho sync: created %d booking(s), skipped %d", created, skipped)
        return {"created": created, "skipped": skipped}
