import logging
from typing import Optional

from app.core.config import settings
from app.integrations.flights.aerodatabox import AeroDataBoxProvider
from app.integrations.flights.aviationstack import AviationStackProvider
from app.integrations.flights.base import BaseFlightProvider, FlightData
from app.integrations.flights.flightaware import FlightAwareProvider
from app.integrations.flights.live_opensky import LiveOpenAeroProvider
from app.integrations.flights.mock_provider import MockFlightProvider

logger = logging.getLogger(__name__)

FLIGHTAWARE = "flightaware"
AERODATABOX = "aerodatabox"
AVIATIONSTACK = "aviationstack"

# Values people leave behind in a .env that must not count as configured.
PLACEHOLDER_PREFIXES = ("mock", "your_", "placeholder", "changeme", "xxx")


def _usable(value: Optional[str]) -> bool:
    key = (value or "").strip()
    return bool(key) and not any(key.lower().startswith(p) for p in PLACEHOLDER_PREFIXES)


def configured_flight_providers() -> dict:
    """Which providers have usable credentials, in preference order."""
    return {
        FLIGHTAWARE: _usable(
            getattr(settings, "FLIGHTAWARE_API_KEY", None) or getattr(settings, "AEROAPI_KEY", None)
        ),
        AERODATABOX: _usable(getattr(settings, "AERODATABOX_API_KEY", None))
        and _usable(getattr(settings, "AERODATABOX_API_HOST", None)),
        AVIATIONSTACK: _usable(getattr(settings, "AVIATIONSTACK_API_KEY", None)),
    }


def flight_provider_status() -> str:
    """A sentence naming what is missing, for the API to hand back on a 503."""
    choice = (settings.FLIGHT_PROVIDER or "auto").strip().lower()
    available = configured_flight_providers()

    if choice in available and not available[choice]:
        setting = {
            FLIGHTAWARE: "AEROAPI_KEY",
            AERODATABOX: "AERODATABOX_API_KEY",
            AVIATIONSTACK: "AVIATIONSTACK_API_KEY",
        }[choice]
        return f"FLIGHT_PROVIDER is '{choice}' but {setting} is not set."
    if choice not in available and choice not in ("auto", ""):
        return (
            f"FLIGHT_PROVIDER '{choice}' is not recognised. "
            "Use 'flightaware', 'aerodatabox', 'aviationstack' or 'auto'."
        )
    return (
        "No live flight data provider is connected. Set AEROAPI_KEY "
        "(FlightAware), AERODATABOX_API_KEY, or AVIATIONSTACK_API_KEY."
    )


def get_flight_provider() -> Optional[BaseFlightProvider]:
    """
    The configured live flight provider, or None when none is configured.

    Returning None matters. This used to fall back to LiveOpenAeroProvider,
    which serves a hardcoded arrival timetable (QF400 at 10:10, EK404 at 19:15,
    anything unknown at 18:30) and derives "delay" from an aircraft's altitude
    and groundspeed. Those are not schedules and not delays, and the dispatch
    service reschedules a real pickup once a delay reaches 15 minutes — so a
    fabricated figure would move a car. Better to report nothing is connected.

    An explicitly chosen provider without credentials does not silently fall
    back to another: the operator asked for a specific data source, and
    swapping it without saying so is how a wrong arrival time goes unnoticed.
    """
    choice = (settings.FLIGHT_PROVIDER or "auto").strip().lower()
    available = configured_flight_providers()

    builders = {
        FLIGHTAWARE: lambda: FlightAwareProvider(),
        AERODATABOX: lambda: AeroDataBoxProvider(),
        AVIATIONSTACK: lambda: AviationStackProvider(),
    }

    if choice in builders:
        if not available[choice]:
            logger.warning(f"Flight provider '{choice}' selected but not configured.")
            return None
        return builders[choice]()

    if choice not in ("auto", ""):
        logger.warning(f"Unrecognised FLIGHT_PROVIDER '{choice}'.")
        return None

    for name in (FLIGHTAWARE, AERODATABOX, AVIATIONSTACK):
        if available[name]:
            return builders[name]()
    return None


__all__ = [
    "BaseFlightProvider",
    "FlightData",
    "FlightAwareProvider",
    "AeroDataBoxProvider",
    "AviationStackProvider",
    "LiveOpenAeroProvider",
    "MockFlightProvider",
    "get_flight_provider",
    "flight_provider_status",
    "configured_flight_providers",
]
