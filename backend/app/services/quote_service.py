import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.maps import map_provider
from app.models.booking import Booking
from app.models.enums import BookingSource, BookingStatus, VehicleCategory, VerificationStatus
from app.models.pricing import Quote
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingLegCreate
from app.schemas.pricing import QuoteAcceptRequest, QuoteOption, QuoteRequest, QuoteResponse
from app.services.booking_service import BookingService
from app.services.pricing_service import PricingEngine


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class QuoteService:
    @staticmethod
    async def generate_quote_number(db: AsyncSession) -> str:
        """Generates sequential quote numbers e.g. QTE-10001."""
        stmt = select(func.count(Quote.id))
        res = await db.execute(stmt)
        count = res.scalar_one() or 0
        next_num = 10001 + count
        while True:
            candidate = f"QTE-{next_num}"
            existing = await db.execute(select(Quote).where(Quote.quote_number == candidate))
            if not existing.scalar_one_or_none():
                return candidate
            next_num += 1

    @staticmethod
    async def create_quote(
        db: AsyncSession,
        quote_in: QuoteRequest
    ) -> QuoteResponse:
        """
        Calculates routes and builds instant quotes across all vehicle classes.
        """
        # 1. Calculate Route using Map Provider
        route = await map_provider.calculate_route(
            quote_in.pickup_address,
            quote_in.dropoff_address
        )

        # 2. Calculate fare options for all vehicle classes
        options: List[QuoteOption] = []
        is_all_inc = False

        for category in [
            VehicleCategory.SEDAN_PREMIUM,
            VehicleCategory.SEDAN_EXECUTIVE,
            VehicleCategory.SUV_PREMIUM,
            VehicleCategory.PEOPLE_MOVER,
            VehicleCategory.MINIBUS,
        ]:
            opt = await PricingEngine.calculate_category_fare(
                db=db,
                category=category,
                route=route,
                pickup_dt=quote_in.pickup_datetime,
                origin_address=quote_in.pickup_address,
                destination_address=quote_in.dropoff_address
            )
            if opt.pricing_breakdown.get("fare_type") == "AIRPORT_ALL_INCLUSIVE":
                is_all_inc = True
            options.append(opt)

        # 3. Store Quote in Database
        quote_number = await QuoteService.generate_quote_number(db)
        expires_at = utc_now() + timedelta(hours=48)
        quote_id = str(uuid.uuid4())

        quote = Quote(
            id=quote_id,
            quote_number=quote_number,
            pickup_address=quote_in.pickup_address,
            dropoff_address=quote_in.dropoff_address,
            pickup_datetime=ensure_utc(quote_in.pickup_datetime),
            distance_km=route.distance_km,
            duration_minutes=route.duration_minutes,
            quote_options=[opt.model_dump() for opt in options],
            is_all_inclusive=is_all_inc,
            expires_at=expires_at
        )
        db.add(quote)
        await db.commit()

        return QuoteResponse(
            quote_id=quote_id,
            quote_number=quote_number,
            pickup_address=quote_in.pickup_address,
            dropoff_address=quote_in.dropoff_address,
            pickup_datetime=quote_in.pickup_datetime,
            distance_km=route.distance_km,
            duration_minutes=route.duration_minutes,
            is_all_inclusive=is_all_inc,
            options=options,
            expires_at=expires_at
        )

    @staticmethod
    async def get_quote_by_id(db: AsyncSession, quote_id: str) -> Optional[Quote]:
        stmt = select(Quote).where(Quote.id == quote_id)
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def accept_quote(
        db: AsyncSession,
        quote_id: str,
        accept_in: QuoteAcceptRequest,
        actor: Optional[User] = None
    ) -> Booking:
        """
        Converts an accepted quote directly into a Master Booking record.
        """
        quote = await QuoteService.get_quote_by_id(db, quote_id)
        if not quote:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quote not found."
            )

        if ensure_utc(quote.expires_at) < utc_now():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This quote has expired. Please request a fresh quote."
            )


        # Find matching option in quote
        selected_option = None
        for opt_dict in quote.quote_options:
            if opt_dict.get("vehicle_category") == accept_in.vehicle_category.value:
                selected_option = opt_dict
                break

        if not selected_option:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Vehicle category '{accept_in.vehicle_category.value}' not found in quote options."
            )

        total_fare = selected_option["total_fare"]
        deposit_req = selected_option["deposit_required"]
        deposit_pct = selected_option["deposit_percentage"]
        breakdown = selected_option["pricing_breakdown"]
        eligibility = selected_option["eligibility"]
        req_verif = selected_option["requires_verification"]
        driver_payout = selected_option["allocation_cost_estimate"]

        # Build booking leg
        leg = BookingLegCreate(
            leg_number=1,
            pickup_address=quote.pickup_address,
            dropoff_address=quote.dropoff_address,
            pickup_datetime=quote.pickup_datetime,
            distance_km=quote.distance_km,
            duration_minutes=quote.duration_minutes,
            vehicle_category=accept_in.vehicle_category,
            allocation_cost=driver_payout,
            is_airport_pickup="airport" in quote.pickup_address.lower()
        )

        booking_create = BookingCreate(
            customer_name=accept_in.customer_name,
            customer_email=accept_in.customer_email,
            customer_phone=accept_in.customer_phone,
            company_name=accept_in.company_name,
            passenger_name=accept_in.passenger_name or accept_in.customer_name,
            passenger_phone=accept_in.passenger_phone or accept_in.customer_phone,
            source=BookingSource.INSTANT_QUOTE,
            fare_type=breakdown.get("fare_type", "STANDARD"),
            total_fare=total_fare,
            deposit_required=deposit_req,
            deposit_percentage=deposit_pct,
            pricing_breakdown=breakdown,
            special_instructions=accept_in.special_instructions,
            legs=[leg]
        )

        booking = await BookingService.create_booking(db, booking_create, actor=actor)

        # Set initial lifecycle status based on eligibility and verification
        if eligibility == "ENQUIRY_REQUIRED":
            booking.status = BookingStatus.ENQUIRY
        elif req_verif:
            booking.status = BookingStatus.VERIFICATION_REQUIRED
            booking.verification_status = VerificationStatus.PENDING
        else:
            booking.status = BookingStatus.QUOTED

        await db.commit()
        await db.refresh(booking)
        return booking
