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

# Background refresh task handle (the iCal feed is ~9 MB and takes ~25s to pull,
# so we never block a request on it once we have any cached copy).
_refresh_task = None


class ZohoCalendarService:
    @staticmethod
    def configured() -> bool:
        return bool((settings.ZOHO_ICAL_URL or "").strip())

    @staticmethod
    def has_cache() -> bool:
        return _cache.get("events") is not None

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
            "pickup": None, "dropoff": None, "phone": None, "email": None,
            "vehicle": None, "flight": None, "name": None, "fare": None,
            "notes": None, "booking_ref": None, "text": None,
        }
        if not desc:
            return out
        text = (desc.replace("\\n", "\n").replace("\\N", "\n")
                    .replace("\\,", ",").replace("\\;", ";").replace("\\\\", "\\")).strip()
        out["text"] = text

        def label(pattern: str) -> Optional[str]:
            m = re.search(rf"{pattern}\s*[:\-]\s*(.+)", text, re.IGNORECASE)
            return m.group(1).strip() if m else None

        out["pickup"] = label(r"pick\s*-?\s*up(?:\s*1)?")
        out["dropoff"] = label(r"drop\s*-?\s*off")
        out["vehicle"] = label(r"vehicle")
        out["name"] = label(r"name")
        flight_raw = label(r"arriving flight") or label(r"flight number") or label(r"flight")
        if flight_raw:
            fm = re.search(r"([A-Za-z]{2,3})\s?(\d{1,4}[A-Za-z]?)", flight_raw)
            out["flight"] = (fm.group(1) + fm.group(2)).upper() if fm else flight_raw.strip()
        else:
            out["flight"] = None
        out["notes"] = label(r"extras") or label(r"extra") or label(r"comments") or label(r"comment") or label(r"note")
        out["booking_ref"] = label(r"booking number") or label(r"booking")
        em = re.search(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", text)
        out["email"] = em.group(0).strip() if em else None
        ph = label(r"contact") or label(r"phone") or label(r"mobile")
        if not ph:
            pm = re.search(r"(\+?\d[\d\s\-]{7,}\d)", text)
            ph = pm.group(1).strip() if pm else None
        out["phone"] = ph
        # Fare: the amount to collect. Handle the many layouts seen in the feed:
        #   "Collect: $170", "Coll: $125 Ex GST", "Collect $120", "Coll $155",
        #   "Airport $120 Coll", "Fare - 150". Avoids add-on $ (Extra/Ribbon) by
        #   requiring a collect/fare/price keyword adjacent to the amount.
        fare = None
        m = re.search(r"\b(?:collect|coll|fare|price)\b\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d+)?)", text, re.I)
        if m:
            fare = m.group(1)
        else:
            m2 = re.search(r"\$\s*([\d,]+(?:\.\d+)?)[^\n$]{0,12}\b(?:coll|collect|fare)\b", text, re.I)
            if m2:
                fare = m2.group(1)
        out["fare"] = fare.replace(",", "") if fare else None
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
                "fare": d["fare"],
                "notes": d["notes"],
                "booking_ref": d["booking_ref"],
                "description": d["text"] or "",
            })
        return out

    @staticmethod
    async def _refresh_cache() -> None:
        url = (settings.ZOHO_ICAL_URL or "").strip()
        if not url:
            return
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            res = await client.get(url)
            res.raise_for_status()
            text = res.text
        _cache["events"] = ZohoCalendarService._parse_ics(text)
        _cache["at"] = time.time()
        logger.info("Zoho iCal: cached %d events", len(_cache["events"]))  # type: ignore[arg-type]

    @staticmethod
    async def warm_cache() -> None:
        """Kick a background refresh (used at startup) so the first user request
        does not pay the ~25s feed download."""
        global _refresh_task
        if _refresh_task is None or _refresh_task.done():
            _refresh_task = asyncio.ensure_future(ZohoCalendarService._refresh_cache())

    @staticmethod
    async def _all_events(force: bool = False, wait_if_empty: bool = True) -> List[Dict]:
        """Stale-while-revalidate: serve the cached copy instantly and refresh in
        the background. Only block when there is no cache at all (and allowed)."""
        global _refresh_task
        ttl = settings.ZOHO_ICAL_CACHE_SECONDS or 900
        now = time.time()
        cached = _cache.get("events")
        fresh = (cached is not None) and (now - float(_cache.get("at", 0))) < ttl
        if fresh and not force:
            return cached  # type: ignore[return-value]

        if _refresh_task is None or _refresh_task.done():
            _refresh_task = asyncio.ensure_future(ZohoCalendarService._refresh_cache())

        # Stale copy available -> return it now; the refresh continues in the bg.
        if cached is not None and not force:
            return cached  # type: ignore[return-value]

        # No cache yet.
        if wait_if_empty or force:
            try:
                await _refresh_task
            except Exception as exc:
                logger.warning("Zoho iCal refresh failed: %s", exc)
            return _cache.get("events") or []  # type: ignore[return-value]
        return cached or []  # type: ignore[return-value]

    @staticmethod
    async def events_in_range(start: str, end: str) -> List[Dict]:
        """start/end are 'YYYY-MM-DD' inclusive (Melbourne day)."""
        # UI path: never block on the slow feed download — serve cache (or empty
        # while the first refresh runs; the client retries).
        evs = await ZohoCalendarService._all_events(wait_if_empty=False)
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
    async def _create_from_event(db, ev: Dict) -> Dict[str, str]:
        """Create ONE dispatch-ready DRAFT booking from a parsed calendar event,
        using its full description details. Idempotent per UID, serialised by a
        lock, with ALL automated reminders suppressed so no SMS ever fires.
        Returns {status: created|duplicate|skipped, booking_number?}."""
        import re
        from datetime import datetime
        from sqlalchemy import select
        from app.models.booking import Booking
        from app.models.enums import BookingSource
        from app.schemas.booking import BookingCreate, BookingLegCreate
        from app.services.booking_service import BookingService

        uid = (ev.get("uid") or "").strip()
        title = (ev.get("title") or "Website booking").strip()
        if not uid or not title:
            return {"status": "skipped"}
        tl = title.lower()
        if any(k in tl for k in ("cancel", "donotdispatch", "do not dispatch", "do-not-dispatch")):
            return {"status": "skipped"}

        tag = f"[zoho-uid:{uid}]"
        async with _sync_lock:
            existing = (
                await db.execute(select(Booking).where(Booking.internal_notes.ilike(f"%{tag}%")))
            ).scalars().first()
            if existing:
                return {"booking_number": existing.booking_number, "status": "duplicate"}

            name = ((ev.get("name") or title) or "Website booking")[:120]
            email = (ev.get("email") or "").strip() or None
            phone = (ev.get("phone") or "").strip() or None
            pickup = (ev.get("pickup") or "").strip()
            dropoff = (ev.get("dropoff") or "").strip()
            if not pickup or not dropoff:
                p2, d2 = ZohoCalendarService._route_from_title(title)
                pickup = pickup or p2 or "See job title"
                dropoff = dropoff or d2 or "See job title"

            def _norm(a: str) -> str:
                a = (a or "").strip()
                if a.upper() == "AP":
                    return "Airport (AP)"
                if len(a) < 3:
                    a = f"{a} — see job title".strip()
                return a[:500]

            pickup = _norm(pickup)
            dropoff = _norm(dropoff)
            vehicle = ZohoCalendarService._guess_vehicle(f"{ev.get('vehicle') or ''} {title}")
            flight = (ev.get("flight") or "").strip() or None
            is_airport = ("airport" in tl) or ("airport" in pickup.lower()) or bool(re.search(r"\bap\b", tl))
            try:
                when = datetime.fromisoformat(ev["start"])
            except Exception:
                return {"status": "skipped"}

            try:
                fare = float(ev.get("fare")) if ev.get("fare") else 0.0
            except Exception:
                fare = 0.0
            extras = (ev.get("notes") or "").strip()
            bref = (ev.get("booking_ref") or "").strip()
            note_bits = ["[Zoho Calendar]", title]
            if bref:
                note_bits.append(f"| Ref: {bref}")
            if extras:
                note_bits.append(f"| Extras: {extras}")
            note_bits.append(tag)

            try:
                booking_in = BookingCreate(
                    customer_name=name,
                    customer_email=email or "calendar-import@opalchauffeurs.com.au",
                    customer_phone=phone or "+61000000000",
                    source=BookingSource.WEBSITE,
                    total_fare=round(fare, 2),
                    deposit_percentage=100.0,
                    flight_tracking_enabled=bool(flight),
                    passenger_name=name,
                    passenger_phone=phone,
                    passenger_email=email,
                    passenger_count=1,
                    luggage_count=0,
                    internal_notes=" ".join(note_bits)[:4000],
                    legs=[BookingLegCreate(
                        leg_number=1,
                        pickup_address=pickup,
                        dropoff_address=dropoff,
                        pickup_datetime=when,
                        vehicle_category=vehicle,
                        is_airport_pickup=is_airport,
                        flight_number=(flight[:20] if flight else None),
                    )],
                )
                booking = await BookingService.create_booking(db, booking_in, notify=False)
                # Suppress every automated reminder for imported jobs — no SMS.
                booking.driver_handover_sent = True
                booking.customer_reminder_12_24h_sent = True
                await db.commit()
                return {"booking_number": booking.booking_number, "status": "created"}
            except Exception as exc:
                await db.rollback()
                logger.warning("Zoho->booking create failed for %s: %s", uid, exc)
                return {"status": "error"}

    @staticmethod
    async def sync_upcoming_to_bookings(db, days_back: int = 1, days_ahead: int = 120) -> Dict[str, int]:
        """Auto-import upcoming Zoho calendar jobs onto the Operate Board as DRAFT,
        dispatchable bookings (full details, idempotent, NO reminder SMS).

        Window is 120 days ahead so far-future bookings are not missing from the
        board (it used to be 14, which hid anything more than two weeks out)."""
        from datetime import datetime, timedelta

        if not ZohoCalendarService.configured():
            return {"created": 0, "skipped": 0}

        today_mel = datetime.now(_MEL).date()
        start = (today_mel - timedelta(days=days_back)).strftime("%Y-%m-%d")
        end = (today_mel + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
        # Backend job: wait for the feed if the cache is cold (unlike the UI path).
        all_events = await ZohoCalendarService._all_events(wait_if_empty=True)
        events = [e for e in all_events if start <= e["date"] <= end]

        created = skipped = 0
        for e in events:
            r = await ZohoCalendarService._create_from_event(db, e)
            if r.get("status") == "created":
                created += 1
            else:
                skipped += 1
        if created:
            logger.info("Zoho sync: created %d booking(s), skipped %d", created, skipped)
        return {"created": created, "skipped": skipped}

    @staticmethod
    async def import_event(db, uid: str) -> Dict[str, str]:
        """On-demand: create ONE dispatch-ready booking from a calendar event."""
        uid = (uid or "").strip()
        if not uid:
            raise ValueError("Missing event id.")
        evs = await ZohoCalendarService._all_events()
        ev = next((e for e in evs if (e.get("uid") or "") == uid), None)
        if not ev:
            raise ValueError("Job not found in the calendar feed.")
        r = await ZohoCalendarService._create_from_event(db, ev)
        if r.get("status") == "error":
            raise ValueError("Could not create the booking from this job.")
        return r
