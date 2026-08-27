import re
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate


def normalize_phone(phone: str) -> str:
    """Normalizes phone numbers to standard format (digits and leading +)."""
    cleaned = re.sub(r"[^\d+]", "", phone.strip())
    return cleaned


class CustomerService:
    @staticmethod
    async def get_by_id(db: AsyncSession, customer_id: str) -> Optional[Customer]:
        """Fetch customer by unique ID."""
        stmt = select(Customer).where(Customer.id == customer_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_email(db: AsyncSession, email: str) -> Optional[Customer]:
        """Fetch customer by email address."""
        stmt = select(Customer).where(Customer.email == email.strip().lower())
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_phone(db: AsyncSession, phone: str) -> Optional[Customer]:
        """Fetch customer by phone number."""
        norm_phone = normalize_phone(phone)
        stmt = select(Customer).where(Customer.phone == norm_phone)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def detect_returning_customer(
        db: AsyncSession,
        email: Optional[str] = None,
        phone: Optional[str] = None
    ) -> Tuple[bool, Optional[Customer], Optional[str]]:
        """
        Detects if a customer is returning by checking email and phone.
        Returns (is_returning, customer_record, match_type).
        """
        norm_email = email.strip().lower() if email else None
        norm_phone = normalize_phone(phone) if phone else None

        if not norm_email and not norm_phone:
            return False, None, None

        if norm_email and norm_phone:
            stmt = select(Customer).where(
                (Customer.email == norm_email) | (Customer.phone == norm_phone)
            )
            result = await db.execute(stmt)
            customers = result.scalars().all()

            # Check if both match the same customer
            for c in customers:
                if c.email == norm_email and c.phone == norm_phone:
                    return True, c, "both"
            # If matched by email first
            for c in customers:
                if c.email == norm_email:
                    return True, c, "email"
            # If matched by phone
            for c in customers:
                if c.phone == norm_phone:
                    return True, c, "phone"

        elif norm_email:
            customer = await CustomerService.get_by_email(db, norm_email)
            if customer:
                return True, customer, "email"
        elif norm_phone:
            customer = await CustomerService.get_by_phone(db, norm_phone)
            if customer:
                return True, customer, "phone"

        return False, None, None

    @staticmethod
    async def find_or_create_customer(
        db: AsyncSession,
        customer_in: CustomerCreate
    ) -> Customer:
        """
        Deduplication rule: If customer exists with matching email or phone,
        reuses the master CRM record to preserve lifetime history.
        """
        is_returning, existing, match_type = await CustomerService.detect_returning_customer(
            db, email=customer_in.email, phone=customer_in.phone
        )

        if is_returning and existing:
            # Update company or notes if newly provided
            if customer_in.company_name and not existing.company_name:
                existing.company_name = customer_in.company_name
            if customer_in.user_id and not existing.user_id:
                existing.user_id = customer_in.user_id
            await db.commit()
            await db.refresh(existing)
            return existing

        # Create new Customer CRM record
        new_customer = Customer(
            user_id=customer_in.user_id,
            full_name=customer_in.full_name.strip(),
            email=customer_in.email.strip().lower(),
            phone=normalize_phone(customer_in.phone),
            company_name=customer_in.company_name.strip() if customer_in.company_name else None,
            is_vip=customer_in.is_vip,
            notes=customer_in.notes
        )
        db.add(new_customer)
        await db.commit()
        await db.refresh(new_customer)
        return new_customer

    @staticmethod
    async def list_customers(
        db: AsyncSession,
        search: Optional[str] = None,
        is_vip: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Customer]:
        """Lists customers with filtering."""
        query = select(Customer)
        if is_vip is not None:
            query = query.where(Customer.is_vip == is_vip)
        if search:
            pattern = f"%{search.strip().lower()}%"
            query = query.where(
                or_(
                    Customer.full_name.ilike(pattern),
                    Customer.email.ilike(pattern),
                    Customer.phone.ilike(pattern),
                    Customer.company_name.ilike(pattern)
                )
            )
        query = query.offset(skip).limit(limit).order_by(Customer.created_at.desc())
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def update_customer(
        db: AsyncSession,
        customer_id: str,
        customer_update: CustomerUpdate
    ) -> Customer:
        """Updates customer CRM record."""
        customer = await CustomerService.get_by_id(db, customer_id)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )

        if customer_update.full_name is not None:
            customer.full_name = customer_update.full_name.strip()
        if customer_update.email is not None:
            customer.email = customer_update.email.strip().lower()
        if customer_update.phone is not None:
            customer.phone = normalize_phone(customer_update.phone)
        if customer_update.company_name is not None:
            customer.company_name = customer_update.company_name.strip() if customer_update.company_name else None
        if customer_update.is_vip is not None:
            customer.is_vip = customer_update.is_vip
        if customer_update.notes is not None:
            customer.notes = customer_update.notes

        await db.commit()
        await db.refresh(customer)
        return customer

    @staticmethod
    async def update_metrics(
        db: AsyncSession,
        customer_id: str,
        add_booking_count: int = 1,
        add_spent_amount: float = 0.0
    ) -> Customer:
        """Increments customer CRM lifetime bookings and spend metrics."""
        customer = await CustomerService.get_by_id(db, customer_id)
        if customer:
            customer.total_bookings += add_booking_count
            customer.total_spent = round(customer.total_spent + add_spent_amount, 2)
            # Automatically flag VIP if lifetime spend > $5,000 or > 10 bookings
            if customer.total_spent >= 5000.0 or customer.total_bookings >= 10:
                customer.is_vip = True
            await db.commit()
            await db.refresh(customer)
        return customer
