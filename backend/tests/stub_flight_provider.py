"""
A stand-in flight provider for tests.

The delay-detection, pickup-rescheduling and notification logic needs a
provider that answers predictably. It used to get one for free, because the
platform shipped a "live" provider that was really a hardcoded timetable —
QF401 always +45 minutes, CX105 always cancelled — and served those numbers
to real operators as live tracking. That is gone from the application, so the
canned answers live here instead, where they cannot reach production.
"""
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Optional

from app.integrations.flights.base import BaseFlightProvider, FlightData


def _at(hour: int, minute: int = 0) -> datetime:
    """A fixed time today, so scheduled/estimated pairs stay deterministic."""
    return datetime.now(timezone.utc).replace(hour=hour, minute=minute, second=0, microsecond=0)


#: flight number -> (airline, origin, destination, terminal, status, delay minutes)
CANNED: Dict[str, tuple] = {
    "QF401": ("Qantas", "SYD", "MEL", "Terminal 1 (Domestic)", "DELAYED", 45),
    "EK406": ("Emirates", "DXB", "MEL", "Terminal 2 (International)", "LANDED", 0),
    "CX105": ("Cathay Pacific", "HKG", "MEL", "Terminal 2 (International)", "CANCELLED", 0),
    "VA820": ("Virgin Australia", "BNE", "MEL", "Terminal 3 (Domestic)", "SCHEDULED", 0),
}

DEFAULT = ("Test Airline", "SYD", "MEL", "Terminal 1", "SCHEDULED", 0)


class StubFlightProvider(BaseFlightProvider):
    """Answers from CANNED; anything unlisted comes back on time."""

    def __init__(self, unknown: Optional[set] = None):
        #: Flight numbers to treat as not found, for the 404 path.
        self.unknown = unknown or set()
        self.calls: list = []

    async def get_flight_status(
        self,
        flight_number: str,
        flight_date: Optional[date] = None
    ) -> Optional[FlightData]:
        key = (flight_number or "").upper().replace(" ", "")
        self.calls.append((key, flight_date))

        if key in self.unknown:
            self.last_error = f"Flight {key} not found."
            return None

        airline, origin, dest, terminal, status, delay = CANNED.get(key, DEFAULT)
        scheduled = _at(13, 0)
        estimated = scheduled + timedelta(minutes=delay)

        return FlightData(
            flight_number=key,
            airline=airline,
            origin_airport=origin,
            destination_airport=dest,
            terminal=terminal,
            scheduled_arrival=scheduled,
            estimated_arrival=estimated,
            actual_arrival=estimated if status == "LANDED" else None,
            status=status,
            delay_minutes=delay,
        )
