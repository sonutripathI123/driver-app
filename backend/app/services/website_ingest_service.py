"""
Turn a booking/quote pushed from one of the business websites into a real
booking in the dashboard.

Reuses BookingService.create_booking so a website booking behaves exactly like
one keyed in by the team: it lands on the Operate Board, files against the
customer's CRM record, and fires the same customer confirmation + portal link.

Idempotency: the website's own reference is stored in internal_notes as a
[web-ref:<ref>] tag; a repeated push with the same reference returns the
existing booking instead of creating a duplicate.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.booking import Booking
from app.models.enums import BookingSource, PaymentStatus, VehicleCategory
from app.schemas.website_ingest import WebsiteBookingIngest


class WebsiteIngestService:
    @staticmethod
    def _ref_tag(external_reference: str) -> str:
        return f"[web-ref:{external_reference.strip()}]"

    @staticmethod
    async def ingest(db: AsyncSession, payload: WebsiteBookingIngest) -> tuple[Booking, bool]:
        """Create (or return the existing) booking for a website submission.

        Returns (booking, duplicate).
        """
        from app.schemas.booking import BookingCreate, BookingLegCreate
        from app.services.booking_service import BookingService

        # 1. Idempotency — skip if we already ingested this website reference.
        if payload.external_reference:
            tag = WebsiteIngestService._ref_tag(payload.external_reference)
            existing = (
                await db.execute(
                    select(Booking)
                    .where(Booking.internal_notes.ilike(f"%{tag}%"))
                    .options(selectinload(Booking.legs), selectinload(Booking.customer))
                )
            ).scalars().first()
            if existing:
                return existing, True

        # 2. Vehicle category (fall back to premium sedan on anything unknown).
        try:
            cat = VehicleCategory(payload.vehicle_category)
        except Exception:
            cat = VehicleCategory.SEDAN_PREMIUM

        # 3. Fare + route. Trust the site's fare if it sent one; otherwise price
        #    it here with the same engine the dashboard uses (Google Maps route).
        total = payload.total_fare
        distance_km = None
        duration_minutes = None
        pricing_breakdown = None
        if total is None:
            from app.integrations.maps import map_provider
            from app.services.pricing_service import PricingEngine

            route = await map_provider.calculate_route(
                payload.pickup_address, payload.dropoff_address
            )
            option = await PricingEngine.calculate_category_fare(
                db, cat, route, payload.pickup_datetime,
                payload.pickup_address, payload.dropoff_address,
            )
            total = round(option.total_fare, 2)
            distance_km = route.distance_km
            duration_minutes = route.duration_minutes
            pricing_breakdown = option.pricing_breakdown

        # 4. Assemble internal notes: source site, quote flag, ref tag, notes.
        note_parts = []
        if payload.is_quote_request:
            note_parts.append("[QUOTE REQUEST]")
        if payload.website:
            note_parts.append(f"[via {payload.website.strip()}]")
        if payload.notes:
            note_parts.append(payload.notes.strip())
        if payload.external_reference:
            note_parts.append(WebsiteIngestService._ref_tag(payload.external_reference))
        internal_notes = " ".join(note_parts) or None

        booking_in = BookingCreate(
            customer_name=payload.customer_name,
            customer_email=payload.customer_email,
            customer_phone=payload.customer_phone,
            source=BookingSource.WEBSITE,
            total_fare=round(total, 2),
            deposit_percentage=100.0,
            pricing_breakdown=pricing_breakdown,
            flight_tracking_enabled=bool(payload.flight_number),
            passenger_name=payload.customer_name,
            passenger_phone=payload.customer_phone,
            passenger_email=payload.customer_email,
            passenger_count=payload.passenger_count,
            luggage_count=payload.luggage_count,
            internal_notes=internal_notes,
            legs=[BookingLegCreate(
                leg_number=1,
                pickup_address=payload.pickup_address,
                dropoff_address=payload.dropoff_address,
                pickup_datetime=payload.pickup_datetime,
                distance_km=distance_km,
                duration_minutes=duration_minutes,
                vehicle_category=cat,
                is_airport_pickup=payload.is_airport_pickup,
                flight_number=(payload.flight_number or None),
            )],
        )

        booking = await BookingService.create_booking(db, booking_in)

        # 5. Record any money already paid on the website.
        if payload.amount_paid and payload.amount_paid > 0:
            booking.paid_amount = round(min(payload.amount_paid, booking.total_fare), 2)
            booking.calculate_balance()
            if booking.balance_amount <= 0.0:
                booking.payment_status = PaymentStatus.PAID_IN_FULL
            else:
                booking.payment_status = PaymentStatus.PARTIAL_DEPOSIT
            await db.commit()
            await db.refresh(booking)

        return booking, False
