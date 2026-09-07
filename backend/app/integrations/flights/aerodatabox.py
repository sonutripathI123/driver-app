from datetime import date, datetime, timezone
import logging
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings
from app.integrations.flights._parsing import delay_minutes, first_str, parse_dt
from app.integrations.flights.base import BaseFlightProvider, FlightData

logger = logging.getLogger(__name__)


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
        if not self.api_key or not self.api_host:
            return None

        clean_flight = flight_number.strip().upper().replace(" ", "")
        target = (flight_date or datetime.now(timezone.utc).date()).isoformat()
        url = f"https://{self.api_host}/flights/number/{clean_flight}/{target}"
        headers = {
            "X-RapidAPI-Key": self.api_key,
            "X-RapidAPI-Host": self.api_host,
            "Accept": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.get(url, headers=headers, params={"withLocation": "false"})

            if res.status_code == 204:
                logger.info(f"AeroDataBox: no flight found for {clean_flight} on {target}")
                return None
            if res.status_code != 200:
                logger.warning(f"AeroDataBox error {res.status_code} for {clean_flight}: {res.text[:300]}")
                return None

            payload: Any = res.json()
            segments: List[Dict[str, Any]] = (
                payload if isinstance(payload, list)
                else payload.get("flights") or payload.get("data") or []
            )
            if not segments:
                return None

            seg = segments[0]
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
            logger.error(f"AeroDataBox lookup exception for {clean_flight}: {ex}")
            return None
