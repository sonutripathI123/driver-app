from app.core.config import settings
from app.integrations.flights.base import BaseFlightProvider, FlightData
from app.integrations.flights.flightaware import FlightAwareProvider
from app.integrations.flights.mock_provider import MockFlightProvider


def get_flight_provider() -> BaseFlightProvider:
    """Returns FlightAwareProvider if API key configured, otherwise MockFlightProvider."""
    api_key = getattr(settings, "FLIGHTAWARE_API_KEY", None)
    if api_key and not api_key.startswith("mock") and not api_key.startswith("your_"):
        return FlightAwareProvider(api_key=api_key)
    return MockFlightProvider()


__all__ = ["BaseFlightProvider", "FlightData", "FlightAwareProvider", "MockFlightProvider", "get_flight_provider"]
