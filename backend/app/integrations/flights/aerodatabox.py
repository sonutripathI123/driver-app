from datetime import date, datetime, timezone
import logging
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings
from app.integrations.flights._parsing import delay_minutes, first_str, parse_dt
from app.integrations.flights.base import BaseFlightProvider, FlightData

logger = logging.getLogger(__name__)


def _select_segment(segments: List[Dict[str, Any]], flight_date: Optional[date]) -> Dict[str, Any]:
    """
    Picks the segment that actually arrives on the requested date.

    A dated query uses dateLocalRole=Both, which matches a flight whose
    *departure* or *arrival* local date falls on that day. A long haul such as
    MH149 (Kuala Lumpur to Melbourne, departing the previous evening) therefore
    returns two segments, and the first is the day before. Taking segments[0]
    reported the wrong day's delay — 0 minutes instead of 26 — which would have
    left a pickup unmoved for a flight that was late.

    The pickup happens at the destination, so match on the arrival date,
    preferring the airport's local date and falling back to UTC.
    """
    if not flight_date or len(segments) == 1:
        return segments[0]

    for key in ("local", "utc"):
        for seg in segments:
            stamp = ((seg.get("arrival") or {}).get("scheduledTime") or {}).get(key)
            parsed = parse_dt(stamp)
            if not parsed:
                continue
            # 'local' is the destination airport's own date, which is the one a
            # dispatcher means; parse_dt normalises to UTC, so compare the raw
            # local date text when we have it.
            candidate = stamp.strip()[:10] if key == "local" else parsed.date().isoformat()
            if candidate == flight_date.isoformat():
                return seg

    return segments[-1]


class AeroDataBoxProvider(BaseFlightProvider):
    """
    AeroDataBox via RapidAPI.

    Cheaper than AeroAPI for low volumes. Needs AERODATABOX_API_KEY (the
    RapidAPI key); AERODATABOX_API_HOST is configurable because RapidAPI has
    changed the host across versions.

    Parsing is deliberately tolerant: field names have moved between AeroDataBox
    releases, so each value is looked up under the shapes known to occur. If the
    arrival time cannot be read the provider returns None rather than guessing —
    the dispatch service moves real pickups from these values.
    """

    def __init__(self, api_key: Optional[str] = None, api_host: Optional[str] = None):
        self.api_key = (api_key or getattr(settings, "AERODATABOX_API_KEY", "") or "").strip()
        self.api_host = (api_host or getattr(settings, "AERODATABOX_API_HOST", "") or "").strip()

    async def get_flight_status(
        self,
        flight_number: str,
        flight_date: Optional[date] = None
    ) -> Optional[FlightData]:
        self.last_error = None
        if not self.api_key or not self.api_host:
            return None

        clean_flight = flight_number.strip().upper().replace(" ", "")
        # With a date, ask for that date. Without one, use the nearest-day form:
        # that is what an operator means by "look this flight up now", and
        # substituting today's date would 204 for a flight that does not run
        # daily. A dated lookup that finds nothing stays empty on purpose —
        # offering the most recent occurrence instead would hand a dispatcher an
        # arrival time from another day.
        url = f"https://{self.api_host}/flights/number/{clean_flight}"
        if flight_date:
            url += f"/{flight_date.isoformat()}"
        headers = {
            "X-RapidAPI-Key": self.api_key,
            "X-RapidAPI-Host": self.api_host,
            "Accept": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                params = {
                    "withAircraftImage": "false",
                    "withLocation": "false",
                    "withFlightPlan": "false",
                }
                if flight_date:
                    params["dateLocalRole"] = "Both"
                res = await client.get(url, headers=headers, params=params)

            if res.status_code == 204 or not res.text.strip():
                logger.info(
                    f"AeroDataBox: no flight found for {clean_flight}"
                    + (f" on {flight_date.isoformat()}" if flight_date else "")
                )
                return None
            if res.status_code != 200:
                self.last_error = f"AeroDataBox HTTP {res.status_code}: {res.text[:200]}"
                logger.warning(self.last_error)
                return None

            payload: Any = res.json()
            segments: List[Dict[str, Any]] = (
                payload if isinstance(payload, list)
                else payload.get("flights") or payload.get("data") or []
            )
            if not segments:
                return None

            seg = _select_segment(segments, flight_date)
            arrival = seg.get("arrival") or {}
            departure = seg.get("departure") or {}

            scheduled = parse_dt(first_str(arrival, "scheduledTime.utc", "scheduledTimeUtc", "scheduledTime"))
            estimated = (
                parse_dt(first_str(arrival, "predictedTime.utc", "predictedTimeUtc"))
                or parse_dt(first_str(arrival, "revisedTime.utc", "revisedTimeUtc"))
                or scheduled
            )
            actual = parse_dt(first_str(arrival, "runwayTime.utc", "runwayTimeUtc", "actualTime.utc"))

            if not scheduled:
                logger.warning(
                    f"AeroDataBox returned {clean_flight} without a readable scheduled arrival; "
                    f"arrival keys were {sorted(arrival.keys())}"
                )
                return None

            return FlightData(
                flight_number=first_str(seg, "number") or clean_flight,
                airline=first_str(seg, "airline.name") or "Commercial Airline",
                origin_airport=(
                    first_str(departure, "airport.iata", "airport.icao", "airport.name") or "Unknown"
                ),
                destination_airport=(
                    first_str(arrival, "airport.iata", "airport.icao", "airport.name") or "Unknown"
                ),
                terminal=first_str(arrival, "terminal"),
                scheduled_arrival=scheduled,
                estimated_arrival=estimated or scheduled,
                actual_arrival=actual,
                status=(first_str(seg, "status") or "SCHEDULED").upper(),
                delay_minutes=delay_minutes(scheduled, estimated),
            )
        except Exception as ex:
            self.last_error = f"AeroDataBox request failed: {ex}"
            logger.error(self.last_error)
            return None
