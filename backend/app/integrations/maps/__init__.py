from app.integrations.maps.base import BaseMapProvider, RouteDetails
from app.integrations.maps.google_maps import GoogleMapsProvider
from app.integrations.maps.mock_maps import MockMapProvider

# Default map provider instance
map_provider: BaseMapProvider = GoogleMapsProvider()

__all__ = ["BaseMapProvider", "RouteDetails", "GoogleMapsProvider", "MockMapProvider", "map_provider"]
