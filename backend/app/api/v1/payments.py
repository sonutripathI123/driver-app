from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.rbac import (
    get_current_active_user,
    require_accountant,
    require_ops,
    require_staff,
)
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.payment import (
    CheckoutSessionResponse,
    CreateCheckoutSessionRequest,
    ManualPaymentCreate,
    PaymentSummaryResponse,
    PaymentTransactionRead,
    RefundRequest,
)
from app.services.booking_service import BookingService
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["Stripe & Payments Management"])


@router.post("/checkout-session", response_model=CheckoutSessionResponse, status_code=status.HTTP_200_OK)
async def create_checkout_session(
    payload: CreateCheckoutSessionRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a hosted Stripe Checkout Session for full fare, deposit, or balance.
    """
    return await PaymentService.create_checkout_session(db, payload)


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    db: AsyncSession = Depends(get_db)
):
    """
    Stripe Webhook endpoint for processing async payment completions, failures, and charge events.
    Verifies cryptographic signatures and guarantees idempotent processing.
    """
    payload_bytes = await request.body()
    try:
        result = await PaymentService.handle_webhook_event(
            db=db,
            payload_bytes=payload_bytes,
            sig_header=stripe_signature
        )
        return {"received": True, "result": result}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Webhook error: {str(e)}"
        )


@router.post("/manual", response_model=PaymentTransactionRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_ops)])
async def record_manual_payment(
    payload: ManualPaymentCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Record an offline manual payment (Bank Transfer, Cash, Card Terminal) with audit trail.
    Access: ADMIN, OPERATIONS_MANAGER, ACCOUNTANT
    """
    return await PaymentService.record_manual_payment(
        db=db,
        manual_in=payload,
        actor=current_user
    )


@router.post("/bookings/{booking_id}/refund", response_model=PaymentTransactionRead, dependencies=[Depends(require_accountant)])
async def process_booking_refund(
    booking_id: str,
    payload: RefundRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Process full or partial refund via Stripe Gateway and update Master Booking.
    Access: ADMIN, ACCOUNTANT
    """
    return await PaymentService.process_refund(
        db=db,
        booking_id=booking_id,
        refund_in=payload,
        actor=current_user
    )


@router.get("/bookings/{booking_id}", response_model=PaymentSummaryResponse)
async def get_booking_payments(
    booking_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve payment transaction history and financial summary for a booking.
    Access: Staff or the booking customer owner.
    """
    booking = await BookingService.get_booking_by_id(db, booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found."
        )

    if current_user.role == UserRole.CUSTOMER:
        if booking.customer.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this booking's payment records."
            )

    return await PaymentService.get_booking_payments(db, booking_id)
