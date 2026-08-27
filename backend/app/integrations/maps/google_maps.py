from typing import Optional, Tuple
import httpx
from app.core.config import settings
from app.integrations.maps.base import BaseMapProvider, RouteDetails
from app.integrations.maps.mock_maps import MockMapProvider


class GoogleMapsProvider(BaseMapProvider):
    """
    Google Maps Platform Routes & Geocoding API adapter.
    Falls back gracefully to MockMapProvider if API key is not configured.
    """
    def __init__(self):
        self.api_key = getattr(settings, "GOOGLE_MAPS_API_KEY", None)
        self.fallback = MockMapProvider()

    async def calculate_route(
        self,
        origin_address: str,
        destination_address: str
    ) -> RouteDetails:
        if not self.api_key or self.api_key.startswith("AIzaSyPlaceholder"):
            return await self.fallback.calculate_route(origin_address, destination_address)

        try:
            url = "https://maps.googleapis.com/maps/api/directions/json"
            params = {
                "origin": origin_address,
                "destination": destination_address,
                "key": self.api_key,
                "mode": "driving"
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, params=params)
                data = response.json()

            if data.get("status") == "OK" and data.get("routes"):
                leg = data["routes"][0]["legs"][0]
                distance_km = round(leg["distance"]["value"] / 1000.0, 2)
                duration_mins = int(round(leg["duration"]["value"] / 60.0))
                orig_loc = leg.get("start_location", {})
                dest_loc = leg.get("end_location", {})

                # Detect tolls if warnings mention toll roads
                warnings = " ".join(data["routes"][0].get("warnings", [])).lower()
                has_tolls = "toll" in warnings

                return RouteDetails(
                    distance_km=distance_km,
                    duration_minutes=duration_mins,
                    origin_lat=orig_loc.get("lat"),
                    origin_lng=orig_loc.get("lng"),
                    destination_lat=dest_loc.get("lat"),
                    destination_lng=dest_loc.get("lng"),
                    tolls_detected=has_tolls,
                    toll_amount_estimated=10.0 if has_tolls else 0.0
                )
        except Exception:
            pass

        return await self.fallback.calculate_route(origin_address, destination_address)

    async def geocode(self, address: str) -> Tuple[Optional[float], Optional[float]]:
        if not self.api_key or self.api_key.startswith("AIzaSyPlaceholder"):
            return await self.fallback.geocode(address)

        try:
            url = "https://maps.googleapis.com/maps/api/geocode/json"
            params = {"address": address, "key": self.api_key}
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, params=params)
                data = response.json()

            if data.get("status") == "OK" and data.get("results"):
                loc = data["results"][0]["geometry"]["location"]
                return loc["lat"], loc["lng"]
        except Exception:
            pass

        return await self.fallback.geocode(address)
