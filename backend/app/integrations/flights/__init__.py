from typing import Optional

from app.core.config import settings
from app.integrations.flights.base import BaseFlightProvider, FlightData
from app.integrations.flights.flightaware import FlightAwareProvider
from app.integrations.flights.live_opensky import LiveOpenAeroProvider
from app.integrations.flights.mock_provider import MockFlightProvider

PLACEHOLDER_PREFIXES = ("mock", "your_", "placeholder", "changeme")


def get_flight_provider() -> Optional[BaseFlightProvider]:
    """
    The configured live flight provider, or None when none is configured.

    Returning None matters: this previously fell back to LiveOpenAeroProvider,
    which serves a hardcoded arrival timetable (QF400 at 10:10, EK404 at 19:15,
    anything unknown at 18:30) and derives "delay" from an aircraft's altitude
    and groundspeed. Those are not schedules and not delays. Presenting them as
    live data would let a dispatcher move a real pickup — the service reschedules
    on a delay of 15 minutes or more — on the strength of a number nobody
    measured. Better to report that no provider is connected.
    """
    api_key = (
        getattr(settings, "FLIGHTAWARE_API_KEY", None)
        or getattr(settings, "AEROAPI_KEY", None)
        or ""
    ).strip()
    if api_key and not any(api_key.lower().startswith(p) for p in PLACEHOLDER_PREFIXES):
        return FlightAwareProvider(api_key=api_key)
    return None


__all__ = [
    "BaseFlightProvider",
    "FlightData",
    "FlightAwareProvider",
    "LiveOpenAeroProvider",
    "MockFlightProvider",
    "get_flight_provider",
]
