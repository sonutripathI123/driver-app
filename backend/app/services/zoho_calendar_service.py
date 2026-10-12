"""
Read the business' Zoho Calendar (all booking channels) from its private iCal
feed and expose the events to the dashboard.

Nothing is made public: the feed URL is a private, resettable token kept in
ZOHO_ICAL_URL. The full feed (thousands of events) is fetched, parsed and cached
in memory for a few minutes; callers ask for a date range and get just that
slice. Times are converted to Australia/Melbourne so the day grouping matches
what the operator sees in Zoho.
"""
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
            out.append({
                "uid": e.get("uid"),
                "title": e.get("title") or "(no title)",
                "location": e.get("location") or "",
                "date": s[0],
                "time": s[1],
                "start": s[2],
                "all_day": s[3],
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
