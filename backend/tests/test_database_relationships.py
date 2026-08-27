from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.booking import Booking
from app.models.booking_leg import BookingLeg
from app.models.customer import Customer
from app.models.driver import Driver
from app.models.enums import (
    AuditAction,
    BookingSource,
    BookingStatus,
    DriverStatus,
    LegStatus,
    PaymentStatus,
    UserRole,
    VehicleCategory,
    VerificationStatus,
)
from app.models.user import User
from app.models.vehicle import Vehicle


@pytest.mark.asyncio
async def test_create_customer(db_session: AsyncSession):
    customer = Customer(
        full_name="Alexander Hamilton",
        email="alex@hamilton.org",
        phone="+61499887766",
        company_name="Treasury Corp",
        is_vip=True,
        notes="Prefers quiet ride and bottled sparkling water."
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)

    assert customer.id is not None
    assert customer.full_name == "Alexander Hamilton"
    assert customer.is_vip is True
    assert customer.total_bookings == 0
    assert customer.total_spent == 0.0


@pytest.mark.asyncio
async def test_create_vehicle_and_driver_relationship(db_session: AsyncSession):
    # 1. Create Vehicle
    vehicle = Vehicle(
        category=VehicleCategory.SEDAN_PREMIUM,
        make="Mercedes-Benz",
        model="S-Class S450",
        year=2024,
        color="Obsidian Black",
        registration_plate="CHAUF-01",
        passenger_capacity=3,
        luggage_capacity=3,
        is_active=True
    )
    db_session.add(vehicle)
    await db_session.commit()
    await db_session.refresh(vehicle)

    assert vehicle.id is not None
    assert vehicle.registration_plate == "CHAUF-01"

    # 2. Create Driver linked to user and default vehicle
    driver_user = User(
        email="john.driver@chauffeurplatform.com",
        hashed_password="hashedpassword123",
        full_name="John Chauffeur",
        phone="+61411223344",
        role=UserRole.DRIVER,
        is_active=True,
        is_verified=True
    )
    db_session.add(driver_user)
    await db_session.commit()
    await db_session.refresh(driver_user)

    driver = Driver(
        user_id=driver_user.id,
        full_name=driver_user.full_name,
        phone=driver_user.phone,
        email=driver_user.email,
        license_number="VIC-DL-98765432",
        accreditation_number="DC-109283",
        status=DriverStatus.AVAILABLE,
        rating=4.95,
        default_vehicle_id=vehicle.id,
        is_active=True
    )
    db_session.add(driver)
    await db_session.commit()
    await db_session.refresh(driver)

    assert driver.id is not None
    assert driver.user_id == driver_user.id
    assert driver.default_vehicle.registration_plate == "CHAUF-01"


@pytest.mark.asyncio
async def test_one_booking_multiple_legs_source_of_truth(db_session: AsyncSession):
    """
    Validates ONE BOOKING -> ONE RECORD -> ONE SOURCE OF TRUTH.
    A return journey contains 2 legs under one master Booking record.
    """
    # 1. Create Customer
    customer = Customer(
        full_name="Sarah Connor",
        email="sarah.connor@sky.net",
        phone="+61433221100"
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)

    # 2. Create Driver & Vehicle
    vehicle = Vehicle(
        category=VehicleCategory.SUV_PREMIUM,
        make="Audi",
        model="Q7",
        year=2024,
        registration_plate="AUDI-VIP",
        passenger_capacity=6,
        luggage_capacity=4
    )
    db_session.add(vehicle)
    await db_session.commit()
    await db_session.refresh(vehicle)

    driver = Driver(
        full_name="Marcus Wright",
        phone="+61488776655",
        email="marcus@drivers.com",
        license_number="NSW-DL-11223344",
        status=DriverStatus.AVAILABLE
    )
    db_session.add(driver)
    await db_session.commit()
    await db_session.refresh(driver)

    # 3. Create Master Booking (Return Journey: Total fare = $450)
    booking = Booking(
        booking_number="CCM-10001",
        customer_id=customer.id,
        source=BookingSource.WEBSITE,
        status=BookingStatus.CONFIRMED,
        payment_status=PaymentStatus.PARTIAL_DEPOSIT,
        verification_status=VerificationStatus.NOT_REQUIRED,
        fare_type="AIRPORT_ALL_INCLUSIVE",
        currency="AUD",
        total_fare=450.0,
        deposit_required=90.0,  # 20% deposit
        deposit_percentage=20.0,
        paid_amount=90.0,
        balance_amount=360.0,
        pricing_breakdown={
            "leg_1": {"base": 200.0, "tolls_included": True, "airport_fee": 25.0},
            "leg_2": {"base": 200.0, "tolls_included": True, "airport_fee": 25.0}
        },
        passenger_name="Sarah Connor",
        passenger_phone="+61433221100",
        passenger_count=2,
        luggage_count=2
    )
    db_session.add(booking)
    await db_session.commit()
    await db_session.refresh(booking)

    # 4. Attach legs directly via relationship or expire session
    now = datetime.now(timezone.utc)
    leg1 = BookingLeg(
        leg_number=1,
        status=LegStatus.ALLOCATED,
        pickup_address="120 Collins St, Melbourne VIC 3000",
        pickup_lat=-37.8142,
        pickup_lng=144.9691,
        dropoff_address="Melbourne Airport (MEL), Terminal 2",
        dropoff_lat=-37.6690,
        dropoff_lng=144.8410,
        pickup_datetime=now + timedelta(days=2),
        distance_km=25.5,
        duration_minutes=35,
        vehicle_category=VehicleCategory.SUV_PREMIUM,
        driver_id=driver.id,
        vehicle_id=vehicle.id,
        allocation_cost=150.0,  # Driver payout base
        is_airport_pickup=False
    )

    leg2 = BookingLeg(
        leg_number=2,
        status=LegStatus.PENDING,
        pickup_address="Melbourne Airport (MEL), Terminal 2",
        pickup_lat=-37.6690,
        pickup_lng=144.8410,
        dropoff_address="120 Collins St, Melbourne VIC 3000",
        dropoff_lat=-37.8142,
        dropoff_lng=144.9691,
        pickup_datetime=now + timedelta(days=5),
        distance_km=25.5,
        duration_minutes=35,
        vehicle_category=VehicleCategory.SUV_PREMIUM,
        allocation_cost=150.0,
        is_airport_pickup=True,
        airline="Qantas",
        flight_number="QF440"
    )

    booking.legs = [leg1, leg2]
    await db_session.commit()
    db_session.expire_all()

    # 6. Verify Central Master Record query
    stmt = select(Booking).where(Booking.booking_number == "CCM-10001")
    result = await db_session.execute(stmt)
    loaded_booking = result.scalar_one()

    assert loaded_booking.customer.full_name == "Sarah Connor"
    assert len(loaded_booking.legs) == 2
    assert loaded_booking.legs[0].leg_number == 1
    assert loaded_booking.legs[0].driver.full_name == "Marcus Wright"
    assert loaded_booking.legs[0].allocation_cost == 150.0
    assert loaded_booking.legs[1].leg_number == 2
    assert loaded_booking.legs[1].is_airport_pickup is True
    assert loaded_booking.legs[1].flight_number == "QF440"

    # Verify balance calculation
    loaded_booking.paid_amount = 450.0
    loaded_booking.calculate_balance()
    assert loaded_booking.balance_amount == 0.0


@pytest.mark.asyncio
async def test_audit_logging_relationship(db_session: AsyncSession):
    # Create customer and booking
    customer = Customer(
        full_name="Thomas Anderson",
        email="neo@matrix.io",
        phone="+61477889900"
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)

    booking = Booking(
        booking_number="CCM-10002",
        customer_id=customer.id,
        status=BookingStatus.DRAFT,
        total_fare=320.0
    )
    db_session.add(booking)
    await db_session.commit()
    await db_session.refresh(booking)

    target_booking_id = booking.id

    # Record Audit Log for status change
    audit = AuditLog(
        booking_id=target_booking_id,
        entity_type="Booking",
        entity_id=target_booking_id,
        action=AuditAction.STATUS_CHANGE,
        actor_role="OPERATIONS_MANAGER",
        actor_email="ops@chauffeurplatform.com",
        old_values={"status": "DRAFT"},
        new_values={"status": "CONFIRMED"},
        reason="Deposit payment confirmed via Stripe Webhook"
    )
    booking.audit_logs.append(audit)
    await db_session.commit()

    # Query booking audit trail
    stmt = select(Booking).where(Booking.id == target_booking_id)
    res = await db_session.execute(stmt)
    retrieved = res.scalar_one()

    assert len(retrieved.audit_logs) == 1
    assert retrieved.audit_logs[0].action == AuditAction.STATUS_CHANGE
    assert retrieved.audit_logs[0].old_values["status"] == "DRAFT"
    assert retrieved.audit_logs[0].new_values["status"] == "CONFIRMED"


