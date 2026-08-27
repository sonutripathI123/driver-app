import hashlib
from typing import Optional, Tuple
from app.integrations.maps.base import BaseMapProvider, RouteDetails


class MockMapProvider(BaseMapProvider):
    """
    Deterministic Mock Map Provider for offline development and test automation.
    Recognizes common routes (Airport, CBD, Suburbs) and calculates realistic distances.
    """
    async def calculate_route(
        self,
        origin_address: str,
        destination_address: str
    ) -> RouteDetails:
        norm_orig = origin_address.lower()
        norm_dest = destination_address.lower()

        # Check for Airport <-> City CBD route
        is_airport = "airport" in norm_orig or "airport" in norm_dest
        is_cbd = "cbd" in norm_orig or "cbd" in norm_dest or "collins" in norm_orig or "collins" in norm_dest or "george st" in norm_orig or "george st" in norm_dest

        if is_airport and is_cbd:
            return RouteDetails(
                distance_km=25.5,
                duration_minutes=35,
                origin_lat=-37.8142 if not "airport" in norm_orig else -37.6690,
                origin_lng=144.9691 if not "airport" in norm_orig else 144.8410,
                destination_lat=-37.6690 if "airport" in norm_dest else -37.8142,
                destination_lng=144.8410 if "airport" in norm_dest else 144.9691,
                tolls_detected=True,
                toll_amount_estimated=12.50
            )

        # Check for Outer Suburban / Long Distance Deadhead
        if "regional" in norm_orig or "regional" in norm_dest or "geelong" in norm_orig or "geelong" in norm_dest or "mornington" in norm_orig or "mornington" in norm_dest:
            return RouteDetails(
                distance_km=75.0,
                duration_minutes=65,
                origin_lat=-37.8142,
                origin_lng=144.9691,
                destination_lat=-38.1499,
                destination_lng=144.3617,
                tolls_detected=True,
                toll_amount_estimated=18.00
            )

        # General distance calculation derived from address hash
        hash_seed = int(hashlib.md5((norm_orig + norm_dest).encode()).hexdigest()[:6], 16)
        distance = round(10.0 + (hash_seed % 350) / 10.0, 1)  # 10km to 45km
        duration = int(distance * 1.4 + 5)

        return RouteDetails(
            distance_km=distance,
            duration_minutes=duration,
            origin_lat=-37.8136,
            origin_lng=144.9631,
            destination_lat=-37.8200,
            destination_lng=144.9800,
            tolls_detected="tolls" in norm_orig or "tolls" in norm_dest,
            toll_amount_estimated=8.50 if ("tolls" in norm_orig or "tolls" in norm_dest) else 0.0
        )

    async def geocode(self, address: str) -> Tuple[Optional[float], Optional[float]]:
        norm = address.lower()
        if "airport" in norm:
            return -37.6690, 144.8410
        if "cbd" in norm or "melbourne" in norm:
            return -37.8136, 144.9631
        return -37.8000, 144.9500
