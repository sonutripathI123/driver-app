from datetime import date, datetime, timezone
import logging
from typing import Optional
import httpx
from app.core.config import settings
from app.integrations.flights.base import BaseFlightProvider, FlightData

logger = logging.getLogger(__name__)


class FlightAwareProvider(BaseFlightProvider):
    """
    FlightAware AeroAPI live provider for real-time commercial flight tracking.
    """

    BASE_URL = "https://aeroapi.flightaware.com/aeroapi"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or getattr(settings, "FLIGHTAWARE_API_KEY", None)

    async def get_flight_status(
        self,
        flight_number: str,
        flight_date: Optional[date] = None
    ) -> Optional[FlightData]:
        if not self.api_key:
            return None

        clean_flight = flight_number.strip().upper().replace(" ", "")
        url = f"{self.BASE_URL}/flights/{clean_flight}"
        headers = {"x-apikey": self.api_key}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, headers=headers)
                if res.status_code != 200:
                    logger.warning(f"FlightAware API error: {res.status_code} - {res.text}")
                    return None

                data = res.json()
                flights = data.get("flights", [])
                if not flights:
                    return None

                # Extract latest flight segment
                seg = flights[0]
                sched_out = seg.get("scheduled_in") or seg.get("estimated_in")
                est_in = seg.get("estimated_in") or sched_out
                act_in = seg.get("actual_in")

                sched_dt = datetime.fromisoformat(sched_out.replace("Z", "+00:00")) if sched_out else datetime.now(timezone.utc)
                est_dt = datetime.fromisoformat(est_in.replace("Z", "+00:00")) if est_in else sched_dt
                act_dt = datetime.fromisoformat(act_in.replace("Z", "+00:00")) if act_in else None

                delay_mins = int((est_dt - sched_dt).total_seconds() / 60) if est_dt and sched_dt else 0

                return FlightData(
                    flight_number=clean_flight,
                    airline=seg.get("operator", "Commercial Airline"),
                    origin_airport=seg.get("origin", {}).get("code_iata", "SYD"),
                    destination_airport=seg.get("destination", {}).get("code_iata", "MEL"),
                    terminal=seg.get("terminal_destination"),
                    scheduled_arrival=sched_dt,
                    estimated_arrival=est_dt,
                    actual_arrival=act_dt,
                    status=seg.get("status", "SCHEDULED").upper(),
                    delay_minutes=delay_mins
                )
        except Exception as e:
            logger.error(f"FlightAware lookup exception for {clean_flight}: {e}")
            return None
