"""
Google Calendar integration (OAuth, offline/refresh-token).

With a client id/secret and a long-lived refresh token the backend mints access
tokens and creates a calendar event for each booking — no interactive login, no
service account. When the credentials are not set, every call is a safe no-op
(returns None) so nothing is fabricated and bookings still work.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger("google_calendar")

_TOKEN_URL = "https://oauth2.googleapis.com/token"
_API = "https://www.googleapis.com/calendar/v3"
_TZ = "Australia/Melbourne"


class GoogleCalendarClient:
    @staticmethod
    def configured() -> bool:
        return bool(
            (settings.GOOGLE_CALENDAR_CLIENT_ID or "").strip()
            and (settings.GOOGLE_CALENDAR_CLIENT_SECRET or "").strip()
            and (settings.GOOGLE_CALENDAR_REFRESH_TOKEN or "").strip()
        )

    @staticmethod
    async def _access_token() -> Optional[str]:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(_TOKEN_URL, data={
                "client_id": settings.GOOGLE_CALENDAR_CLIENT_ID.strip(),
                "client_secret": settings.GOOGLE_CALENDAR_CLIENT_SECRET.strip(),
                "refresh_token": settings.GOOGLE_CALENDAR_REFRESH_TOKEN.strip(),
                "grant_type": "refresh_token",
            })
            res.raise_for_status()
            return res.json().get("access_token")

    @staticmethod
    async def create_event(
        summary: str,
        description: str,
        location: str,
        start: datetime,
        end: datetime,
    ) -> Optional[str]:
        """Create a calendar event. Returns the event id, or None if off/failed."""
        if not GoogleCalendarClient.configured():
            return None
        try:
            token = await GoogleCalendarClient._access_token()
            if not token:
                return None
            cal_id = (settings.GOOGLE_CALENDAR_ID or "primary").strip()
            body = {
                "summary": summary,
                "description": description,
                "location": location,
                "start": {"dateTime": start.isoformat(), "timeZone": _TZ},
                "end": {"dateTime": end.isoformat(), "timeZone": _TZ},
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(
                    f"{_API}/calendars/{cal_id}/events",
                    headers={"Authorization": f"Bearer {token}"},
                    json=body,
                )
                res.raise_for_status()
                return res.json().get("id")
        except Exception as exc:
            logger.warning("Google Calendar event not created: %s", exc)
            return None

    @staticmethod
    async def create_event_for_booking(booking) -> Optional[str]:
        """Build and create a calendar event from a booking's first leg."""
        if not GoogleCalendarClient.configured():
            return None
        leg = booking.legs[0] if getattr(booking, "legs", None) else None
        if not leg or not leg.pickup_datetime:
            return None

        start = leg.pickup_datetime
        mins = leg.duration_minutes if getattr(leg, "duration_minutes", None) else 60
        end = start + timedelta(minutes=mins or 60)

        passenger = booking.passenger_name or "Passenger"
        summary = f"#{booking.booking_number} — {passenger}"
        desc_lines = [
            f"Booking: #{booking.booking_number}",
            f"Passenger: {passenger}" + (f" ({booking.passenger_phone})" if booking.passenger_phone else ""),
            f"Pickup: {leg.pickup_address}",
            f"Dropoff: {leg.dropoff_address}",
            f"Vehicle: {getattr(leg.vehicle_category, 'value', leg.vehicle_category)}",
            f"Fare: ${booking.total_fare:.2f} AUD",
        ]
        if getattr(leg, "flight_number", None):
            desc_lines.append(f"Flight: {leg.flight_number}")
        return await GoogleCalendarClient.create_event(
            summary=summary,
            description="\n".join(desc_lines),
            location=leg.pickup_address or "",
            start=start,
            end=end,
        )
