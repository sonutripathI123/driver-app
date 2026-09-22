"""
Customer self-service portal.

A customer gets a set-password link on their first booking; once they set a
password a User (role CUSTOMER) is linked to their Customer record, and they can
log in any time to see their bookings, their totals, and (later) re-book.
Everything here is scoped to the authenticated customer's own data.
"""
from typing import List

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import create_customer_setup_token, decode_token, hash_password
from app.models.booking import Booking
from app.models.customer import Customer
from app.models.enums import BookingStatus, LegStatus, UserRole
from app.models.user import User
from app.schemas.customer_portal import CustomerBookingItem, CustomerPortalProfile


ACTIVE_STATUSES = {
    BookingStatus.CONFIRMED, BookingStatus.ALLOCATED, BookingStatus.DISPATCHED,
    BookingStatus.EN_ROUTE, BookingStatus.ARRIVED, BookingStatus.PICKED_UP,
}


class CustomerPortalService:

    @staticmethod
    def setup_link(customer_id: str) -> str:
        """The first-booking link a customer uses to set their password."""
        token = create_customer_setup_token(customer_id)
        base = (settings.PUBLIC_APP_URL or "").rstrip("/")
        return f"{base}/set-password?token={token}"

    @staticmethod
    async def set_password(db: AsyncSession, token: str, password: str) -> Customer:
        try:
            payload = decode_token(token)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This setup link is invalid or has expired. Ask us to resend it.")
        if payload.get("purpose") != "customer_setup":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This link cannot be used to set a password.")
        customer_id = payload.get("sub")
        customer = await db.get(Customer, customer_id)
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")

        email = (customer.email or "").strip().lower()
        if not email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This account has no email to sign in with.")

        # Link an existing User by email, or create one, and set the password.
        user = None
        if customer.user_id:
            user = await db.get(User, customer.user_id)
        if not user:
            existing = await db.execute(select(User).where(User.email == email))
            user = existing.scalar_one_or_none()
        if user:
            user.hashed_password = hash_password(password)
            if user.role not in (UserRole.CUSTOMER, UserRole.ADMIN):
                user.role = UserRole.CUSTOMER
            user.is_active = True
        else:
            user = User(
                email=email,
                hashed_password=hash_password(password),
                full_name=customer.full_name,
                phone=customer.phone,
                role=UserRole.CUSTOMER,
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            await db.flush()
        customer.user_id = user.id
        await db.commit()
        await db.refresh(customer)
        return customer

    @staticmethod
    async def get_customer_by_user(db: AsyncSession, user: User) -> Customer:
        stmt = select(Customer).where(
            (Customer.user_id == user.id) | (Customer.email == user.email)
        )
        res = await db.execute(stmt)
        customer = res.scalars().first()
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No customer profile is linked to this account.")
        if customer.user_id != user.id:
            customer.user_id = user.id
            await db.commit()
            await db.refresh(customer)
        return customer

    @staticmethod
    async def _bookings(db: AsyncSession, customer_id: str) -> List[Booking]:
        stmt = (
            select(Booking)
            .where(Booking.customer_id == customer_id)
            .options(selectinload(Booking.legs))
            .order_by(Booking.created_at.desc())
        )
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def get_profile(db: AsyncSession, customer: Customer) -> CustomerPortalProfile:
        bookings = await CustomerPortalService._bookings(db, customer.id)
        completed = sum(1 for b in bookings if b.status == BookingStatus.COMPLETED)
        upcoming = sum(1 for b in bookings if b.status in ACTIVE_STATUSES)
        total_spent = round(sum((b.paid_amount or 0) for b in bookings), 2)
        outstanding = round(sum((b.balance_amount or 0) for b in bookings), 2)
        return CustomerPortalProfile(
            id=customer.id,
            full_name=customer.full_name,
            email=customer.email,
            phone=customer.phone,
            company_name=customer.company_name,
            is_vip=customer.is_vip,
            total_bookings=len(bookings),
            completed_trips=completed,
            upcoming_trips=upcoming,
            total_spent=total_spent,
            outstanding_balance=outstanding,
        )

    @staticmethod
    async def _compute_fare(db: AsyncSession, req):
        """Real route + fare for a customer's chosen trip (Google Maps on prod)."""
        from app.integrations.maps import map_provider
        from app.models.enums import VehicleCategory
        from app.services.pricing_service import PricingEngine
        try:
            cat = VehicleCategory(req.vehicle_category)
        except Exception:
            cat = VehicleCategory.SEDAN_PREMIUM
        route = await map_provider.calculate_route(req.pickup_address, req.dropoff_address)
        option = await PricingEngine.calculate_category_fare(
            db, cat, route, req.pickup_datetime, req.pickup_address, req.dropoff_address
        )
        return option, route, cat

    @staticmethod
    async def quote(db: AsyncSession, req):
        from app.schemas.customer_portal import CustomerQuoteResponse
        option, route, cat = await CustomerPortalService._compute_fare(db, req)
        return CustomerQuoteResponse(
            total_fare=round(option.total_fare, 2),
            distance_km=route.distance_km,
            vehicle_category=cat.value,
        )

    @staticmethod
    async def create_booking(db: AsyncSession, customer: Customer, req):
        from app.models.enums import BookingSource
        from app.schemas.booking import BookingCreate, BookingLegCreate
        from app.services.booking_service import BookingService

        option, route, cat = await CustomerPortalService._compute_fare(db, req)
        booking_in = BookingCreate(
            customer_id=customer.id,
            customer_name=customer.full_name,
            customer_email=customer.email,
            customer_phone=customer.phone,
            source=BookingSource.APP,
            total_fare=round(option.total_fare, 2),
            deposit_percentage=100.0,
            pricing_breakdown=option.pricing_breakdown,
            passenger_name=customer.full_name,
            passenger_phone=customer.phone,
            passenger_email=customer.email,
            passenger_count=req.passenger_count,
            luggage_count=req.luggage_count,
            legs=[BookingLegCreate(
                leg_number=1,
                pickup_address=req.pickup_address,
                dropoff_address=req.dropoff_address,
                pickup_datetime=req.pickup_datetime,
                distance_km=route.distance_km,
                duration_minutes=route.duration_minutes,
                vehicle_category=cat,
                is_airport_pickup=req.is_airport_pickup,
                flight_number=(req.flight_number or None),
            )],
        )
        return await BookingService.create_booking(db, booking_in)

    @staticmethod
    async def get_bookings(db: AsyncSession, customer: Customer) -> List[CustomerBookingItem]:
        bookings = await CustomerPortalService._bookings(db, customer.id)
        items: List[CustomerBookingItem] = []
        for b in bookings:
            first = b.legs[0] if b.legs else None
            items.append(CustomerBookingItem(
                id=b.id,
                booking_number=b.booking_number,
                status=b.status.value if hasattr(b.status, "value") else str(b.status),
                payment_status=b.payment_status.value if hasattr(b.payment_status, "value") else (str(b.payment_status) if b.payment_status else None),
                total_fare=b.total_fare,
                currency=b.currency or "AUD",
                passenger_name=b.passenger_name,
                pickup_datetime=first.pickup_datetime if first else None,
                pickup_address=first.pickup_address if first else None,
                dropoff_address=first.dropoff_address if first else None,
                created_at=b.created_at,
            ))
        return items
