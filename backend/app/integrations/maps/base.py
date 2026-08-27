from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass
class RouteDetails:
    distance_km: float
    duration_minutes: int
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    tolls_detected: bool = False
    toll_amount_estimated: float = 0.0


class BaseMapProvider(ABC):
    """
    Abstract interface for Geocoding and Routing distance calculations.
    """
    @abstractmethod
    async def calculate_route(
        self,
        origin_address: str,
        destination_address: str
    ) -> RouteDetails:
        """Calculates driving distance, estimated duration, and tolls between two addresses."""
        pass

    @abstractmethod
    async def geocode(self, address: str) -> Tuple[Optional[float], Optional[float]]:
        """Resolves an address string to (latitude, longitude)."""
        pass
