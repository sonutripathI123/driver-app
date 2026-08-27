from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.rbac import require_ops
from app.schemas.customer import (
    CustomerCreate,
    CustomerLookupResponse,
    CustomerRead,
    CustomerUpdate,
)
from app.services.customer_service import CustomerService

router = APIRouter(prefix="/customers", tags=["Customer CRM"])


@router.get("/", response_model=List[CustomerRead], dependencies=[Depends(require_ops)])
async def list_customers(
    search: Optional[str] = Query(None, description="Search name, email, phone, company"),
    is_vip: Optional[bool] = Query(None, description="Filter by VIP status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """
    List CRM customer profiles.
    Access: ADMIN, OPERATIONS_MANAGER
    """
    return await CustomerService.list_customers(
        db=db,
        search=search,
        is_vip=is_vip,
        skip=skip,
        limit=limit
    )


@router.get("/lookup", response_model=CustomerLookupResponse, dependencies=[Depends(require_ops)])
async def lookup_returning_customer(
    email: Optional[str] = Query(None, description="Customer email to match"),
    phone: Optional[str] = Query(None, description="Customer phone to match"),
    db: AsyncSession = Depends(get_db)
):
    """
    Detect returning customer by email or phone to prefill details and avoid duplicates.
    Access: ADMIN, OPERATIONS_MANAGER
    """
    if not email and not phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either email or phone for customer lookup."
        )

    is_returning, customer, match_type = await CustomerService.detect_returning_customer(
        db=db,
        email=email,
        phone=phone
    )

    return CustomerLookupResponse(
        is_returning=is_returning,
        customer=CustomerRead.model_validate(customer) if customer else None,
        match_type=match_type
    )


@router.post("/", response_model=CustomerRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_ops)])
async def create_or_find_customer(
    customer_in: CustomerCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new customer CRM record (or reuse existing record if email/phone matches).
    Access: ADMIN, OPERATIONS_MANAGER
    """
    return await CustomerService.find_or_create_customer(
        db=db,
        customer_in=customer_in
    )


@router.get("/{customer_id}", response_model=CustomerRead, dependencies=[Depends(require_ops)])
async def get_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get customer details.
    Access: ADMIN, OPERATIONS_MANAGER
    """
    customer = await CustomerService.get_by_id(db, customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    return customer


@router.patch("/{customer_id}", response_model=CustomerRead, dependencies=[Depends(require_ops)])
async def update_customer(
    customer_id: str,
    customer_update: CustomerUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update customer details.
    Access: ADMIN, OPERATIONS_MANAGER
    """
    return await CustomerService.update_customer(
        db=db,
        customer_id=customer_id,
        customer_update=customer_update
    )
