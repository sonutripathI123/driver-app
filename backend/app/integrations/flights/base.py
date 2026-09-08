from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional


@dataclass
class FlightData:
    flight_number: str
    airline: str
    origin_airport: str
    destination_airport: str
    terminal: Optional[str]
    scheduled_arrival: datetime
    estimated_arrival: datetime
    actual_arrival: Optional[datetime]
    status: str  # "SCHEDULED", "EN_ROUTE", "LANDED", "DELAYED", "CANCELLED", "DIVERTED"
    delay_minutes: int


class BaseFlightProvider(ABC):
    #: Why the most recent lookup returned nothing. Without this a provider
    #: refusal, a network block and a genuinely unknown flight all surfaced as
    #: the same bare 404, with the cause only in logs the operator cannot see.
    last_error: Optional[str] = None

    @abstractmethod
    async def get_flight_status(
        self,
        flight_number: str,
        flight_date: Optional[date] = None
    ) -> Optional[FlightData]:
        """Fetch real-time flight status and touchdown estimate."""
        pass
