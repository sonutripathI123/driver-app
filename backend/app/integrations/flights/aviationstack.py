from datetime import date
import logging
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings
from app.integrations.flights._parsing import delay_minutes, first_str, parse_dt
from app.integrations.flights.base import BaseFlightProvider, FlightData

logger = logging.getLogger(__name__)


class AviationStackProvider(BaseFlightProvider):
    """
    AviationStack real-time flights.

    Needs AVIATIONSTACK_API_KEY. The endpoint is configurable via
    AVIATIONSTACK_API_URL because AviationStack's free plan serves HTTP only —
    the default here is HTTPS so the key is not sent in clear text, and a free
    plan must opt into the HTTP endpoint explicitly rather than have it chosen
    silently.

    AviationStack reports arrival.delay in minutes directly; it is preferred
    over recomputing from timestamps, which can disagree when only an estimate
    is published.
    """

    def __init__(self, api_key: Optional[str] = None, api_url: Optional[str] = None):
        self.api_key = (api_key or getattr(settings, "AVIATIONSTACK_API_KEY", "") or "").strip()
        self.api_url = (
            api_url
            or getattr(settings, "AVIATIONSTACK_API_URL", "")
            or "https://api.aviationstack.com/v1/flights"
        ).strip()

    async def get_flight_status(
        self,
        flight_number: str,
        flight_date: Optional[date] = None
    ) -> Optional[FlightData]:
        if not self.api_key:
            return None

        clean_flight = flight_number.strip().upper().replace(" ", "")
        params: Dict[str, Any] = {"access_key": self.api_key, "flight_iata": clean_flight}
        if flight_date:
            params["flight_date"] = flight_date.isoformat()

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.get(self.api_url, params=params)

            if res.status_code != 200:
                logger.warning(f"AviationStack error {res.status_code} for {clean_flight}: {res.text[:300]}")
                return None

            payload: Dict[str, Any] = res.json()
            # Errors arrive with HTTP 200 and an "error" object.
            if isinstance(payload.get("error"), dict):
                err = payload["error"]
                logger.warning(
                    f"AviationStack refused {clean_flight}: "
                    f"{err.get('code')} {err.get('message') or err.get('info')}"
                )
                return None

            segments: List[Dict[str, Any]] = payload.get("data") or []
            if not segments:
                return None

            seg = segments[0]
            arrival = seg.get("arrival") or {}
            departure = seg.get("departure") or {}

            scheduled = parse_dt(arrival.get("scheduled"))
            estimated = parse_dt(arrival.get("estimated")) or scheduled
            actual = parse_dt(arrival.get("actual"))

            if not scheduled:
                logger.warning(
                    f"AviationStack returned {clean_flight} without a scheduled arrival; "
                    f"arrival keys were {sorted(arrival.keys())}"
                )
                return None

            reported_delay = arrival.get("delay")
            delay = (
                max(0, int(reported_delay))
                if isinstance(reported_delay, (int, float))
                else delay_minutes(scheduled, estimated)
            )

            return FlightData(
                flight_number=first_str(seg, "flight.iata", "flight.icao") or clean_flight,
                airline=first_str(seg, "airline.name") or "Commercial Airline",
                origin_airport=(
                    first_str(departure, "iata", "icao", "airport") or "Unknown"
                ),
                destination_airport=(
                    first_str(arrival, "iata", "icao", "airport") or "Unknown"
                ),
                terminal=first_str(arrival, "terminal"),
                scheduled_arrival=scheduled,
                estimated_arrival=estimated or scheduled,
                actual_arrival=actual,
                status=(first_str(seg, "flight_status") or "SCHEDULED").upper(),
                delay_minutes=delay,
            )
        except Exception as ex:
            logger.error(f"AviationStack lookup exception for {clean_flight}: {ex}")
            return None
