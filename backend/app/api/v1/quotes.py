from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.booking import BookingRead
from app.schemas.pricing import QuoteAcceptRequest, QuoteRequest, QuoteResponse
from app.services.quote_service import QuoteService

router = APIRouter(prefix="/quotes", tags=["Instant Quotes & Pricing"])


@router.post("/instant", response_model=QuoteResponse, status_code=status.HTTP_200_OK)
async def generate_instant_quote(
    quote_in: QuoteRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate instant fare quote across all vehicle classes with itemized breakdowns.
    """
    return await QuoteService.create_quote(db, quote_in)


@router.get("/{quote_id}")
async def get_quote_details(
    quote_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve quote by unique ID.
    """
    quote = await QuoteService.get_quote_by_id(db, quote_id)
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found."
        )
    return quote


@router.post("/{quote_id}/accept", response_model=BookingRead, status_code=status.HTTP_201_CREATED)
async def accept_quote_and_create_booking(
    quote_id: str,
    accept_in: QuoteAcceptRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Accept an instant quote and directly convert it into a Master Booking (CCM-XXXXX).
    """
    booking = await QuoteService.accept_quote(
        db=db,
        quote_id=quote_id,
        accept_in=accept_in
    )
    return booking
