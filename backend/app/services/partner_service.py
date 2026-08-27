import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit import AuditLog
from app.models.booking import Booking
from app.models.booking_leg import BookingLeg
from app.models.enums import AuditAction, LegStatus, PayoutBatchStatus
from app.models.partner import Partner
from app.models.partner_offer import PartnerJobOffer
from app.models.partner_payout import PartnerPayoutBatch
from app.models.user import User
from app.schemas.partner import (
    PartnerComplianceCheckResponse,
    PartnerCreate,
    PartnerJobOfferCreate,
    PartnerPayoutBatchCreate,
    PartnerUpdate,
)
from app.services.dispatch_service import DispatchService
from app.services.notification_service import NotificationService


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class PartnerService:
    @staticmethod
    async def create_partner(db: AsyncSession, partner_in: PartnerCreate) -> Partner:
        """Create a new subcontractor / affiliate partner record."""
        partner = Partner(
            company_name=partner_in.company_name.strip(),
            contact_name=partner_in.contact_name.strip(),
            email=partner_in.email.strip().lower(),
            phone=partner_in.phone.strip(),
            abn=partner_in.abn.strip() if partner_in.abn else None,
            commission_rate=partner_in.commission_rate,
            city=partner_in.city,
            is_active=partner_in.is_active,
            insurance_policy_number=partner_in.insurance_policy_number,
            insurance_expiry=partner_in.insurance_expiry,
            accreditation_number=partner_in.accreditation_number,
            accreditation_expiry=partner_in.accreditation_expiry,
            is_compliance_verified=partner_in.is_compliance_verified,
            notes=partner_in.notes
        )
        db.add(partner)
        await db.commit()
        await db.refresh(partner)
        return partner

    @staticmethod
    async def update_partner(db: AsyncSession, partner_id: str, partner_in: PartnerUpdate) -> Partner:
        """Update affiliate partner details and compliance records."""
        partner = await db.get(Partner, partner_id)
        if not partner:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found.")

        data = partner_in.model_dump(exclude_unset=True)
        for key, val in data.items():
            setattr(partner, key, val)

        await db.commit()
        await db.refresh(partner)
        return partner

    @staticmethod
    async def check_compliance(
        db: AsyncSession,
        partner_id: str,
        pickup_datetime: Optional[datetime] = None
    ) -> PartnerComplianceCheckResponse:
        """
        Verifies partner insurance validity and accreditation status.
        Blocks allocation if compliance documents are expired.
        """
        partner = await db.get(Partner, partner_id)
        if not partner:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found.")

        target_time = ensure_utc(pickup_datetime) if pickup_datetime else utc_now()
        reasons: List[str] = []
        is_compliant = True

        if not partner.is_active:
            is_compliant = False
            reasons.append("Partner account is inactive.")

        insurance_valid = True
        if partner.insurance_expiry:
            if ensure_utc(partner.insurance_expiry) < target_time:
                insurance_valid = False
                is_compliant = False
                reasons.append(f"Public liability insurance expired on {partner.insurance_expiry.strftime('%Y-%m-%d')}.")
        else:
            insurance_valid = False
            is_compliant = False
            reasons.append("No insurance policy registered on file.")

        accreditation_valid = True
        if partner.accreditation_expiry:
            if ensure_utc(partner.accreditation_expiry) < target_time:
                accreditation_valid = False
                is_compliant = False
                reasons.append(f"Commercial accreditation expired on {partner.accreditation_expiry.strftime('%Y-%m-%d')}.")

        return PartnerComplianceCheckResponse(
            partner_id=partner.id,
            company_name=partner.company_name,
            is_compliant=is_compliant,
            insurance_valid=insurance_valid,
            insurance_expiry=partner.insurance_expiry,
            accreditation_valid=accreditation_valid,
            accreditation_expiry=partner.accreditation_expiry,
            is_active=partner.is_active,
            reasons=reasons
        )

    @staticmethod
    async def broadcast_job_offer(
        db: AsyncSession,
        req: PartnerJobOfferCreate,
        actor: Optional[User] = None
    ) -> PartnerJobOffer:
        """
        Broadcasts a time-bounded job offer to an affiliate partner (15-min expiry).
        Enforces partner compliance gates and margin validation.
        """
        # 1. Check partner compliance
        comp = await PartnerService.check_compliance(db, req.partner_id)
        if not comp.is_compliant:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot offload to partner '{comp.company_name}': {'; '.join(comp.reasons)}"
            )

        # 2. Check leg eligibility
        stmt = select(BookingLeg).where(BookingLeg.id == req.leg_id).options(selectinload(BookingLeg.booking))
        res = await db.execute(stmt)
        leg = res.scalar_one_or_none()
        if not leg:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking leg not found.")

        if leg.status in (LegStatus.COMPLETED, LegStatus.CANCELLED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot offer leg with status '{leg.status.value}'."
            )

        # 3. Margin Guard: Ensure customer fare >= offered payout
        booking_fare = leg.booking.total_fare if leg.booking else 0.0
        legs_count = max(1, len(leg.booking.legs) if leg.booking and leg.booking.legs else 1)
        leg_customer_fare = round(booking_fare / legs_count, 2)

        if req.offered_payout > leg_customer_fare:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Negative margin guard: Offered payout (${req.offered_payout:.2f}) exceeds customer leg fare (${leg_customer_fare:.2f})."
            )

        now = utc_now()
        expires_at = now + timedelta(minutes=req.expiry_minutes)

        offer = PartnerJobOffer(
            id=str(uuid.uuid4()),
            leg_id=req.leg_id,
            partner_id=req.partner_id,
            offered_payout=req.offered_payout,
            status="PENDING",
            expires_at=expires_at,
            notes=req.notes
        )
        db.add(offer)

        # Send broadcast notification to Partner
        partner = await db.get(Partner, req.partner_id)
        if partner and partner.email:
            msg = f"New Job Offer from Crown Chauffeurs: {leg.pickup_address} → {leg.dropoff_address} on {leg.pickup_datetime.strftime('%Y-%m-%d %I:%M %p')}. Payout: ${req.offered_payout:.2f}. Please accept within {req.expiry_minutes} mins."
            await NotificationService.record_and_dispatch_email(
                db, partner.email, "PARTNER_JOB_OFFER_EMAIL", msg, msg, leg.booking_id
            )

        await db.commit()
        await db.refresh(offer)
        return offer

    @staticmethod
    async def accept_job_offer(
        db: AsyncSession,
        offer_id: str,
        partner_reference: Optional[str] = None
    ) -> PartnerJobOffer:
        """
        Partner accepts the job offer before expiry.
        Automatically offloads the leg and marks offer ACCEPTED.
        """
        stmt = (
            select(PartnerJobOffer)
            .where(PartnerJobOffer.id == offer_id)
            .options(
                selectinload(PartnerJobOffer.leg).selectinload(BookingLeg.booking),
                selectinload(PartnerJobOffer.partner)
            )
        )
        res = await db.execute(stmt)
        offer = res.scalar_one_or_none()
        if not offer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job offer not found.")

        if offer.status != "PENDING":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Offer is no longer active (Status: {offer.status})."
            )

        now = utc_now()
        if ensure_utc(offer.expires_at) < now:
            offer.status = "EXPIRED"
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Job offer has expired."
            )

        # Mark accepted
        offer.status = "ACCEPTED"
        offer.responded_at = now

        # Execute offload allocation
        await DispatchService.offload_leg_to_partner(
            db=db,
            leg_id=offer.leg_id,
            partner_id=offer.partner_id,
            partner_payout_amount=offer.offered_payout,
            partner_reference=partner_reference or f"OFFER-{offer.id[:8]}"
        )

        await db.commit()
        await db.refresh(offer)
        return offer

    @staticmethod
    async def decline_job_offer(
        db: AsyncSession,
        offer_id: str,
        reason: Optional[str] = None
    ) -> PartnerJobOffer:
        """Partner declines the job offer."""
        offer = await db.get(PartnerJobOffer, offer_id)
        if not offer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job offer not found.")

        offer.status = "DECLINED"
        offer.responded_at = utc_now()
        if reason:
            offer.notes = f"{offer.notes or ''} [DECLINED: {reason}]".strip()

        await db.commit()
        await db.refresh(offer)
        return offer

    @staticmethod
    async def expire_stale_offers(db: AsyncSession) -> int:
        """Background maintenance runner: expires pending offers past their expiry deadline."""
        now = utc_now()
        stmt = select(PartnerJobOffer).where(PartnerJobOffer.status == "PENDING")
        res = await db.execute(stmt)
        pending_offers = list(res.scalars().all())

        expired_count = 0
        for off in pending_offers:
            if ensure_utc(off.expires_at) < now:
                off.status = "EXPIRED"
                expired_count += 1

        if expired_count > 0:
            await db.commit()
        return expired_count

    @staticmethod
    async def generate_partner_payout_batch(
        db: AsyncSession,
        req: PartnerPayoutBatchCreate,
        actor: Optional[User] = None
    ) -> PartnerPayoutBatch:
        """
        Generates Subcontractor Partner Settlement RCTI Batch.
        """
        partner = await db.get(Partner, req.partner_id)
        if not partner:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found.")

        stmt = (
            select(BookingLeg)
            .where(
                BookingLeg.partner_id == req.partner_id,
                BookingLeg.status == LegStatus.COMPLETED
            )
        )
        res = await db.execute(stmt)
        all_completed_legs = list(res.scalars().all())

        start_utc = ensure_utc(req.period_start)
        end_utc = ensure_utc(req.period_end)

        legs = [
            l for l in all_completed_legs
            if l.completed_at and start_utc <= ensure_utc(l.completed_at) <= end_utc
        ]

        if not legs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No completed offloaded legs found for this partner within the specified period."
            )

        gross_payout = sum(leg.partner_payout_amount for leg in legs)
        gst_amount = round(gross_payout * 0.10, 2)
        net_disbursed = round(gross_payout + gst_amount, 2)

        year = utc_now().year
        count_stmt = select(func.count(PartnerPayoutBatch.id)).where(PartnerPayoutBatch.batch_number.like(f"PARTNER-RCTI-{year}-%"))
        c_res = await db.execute(count_stmt)
        count = c_res.scalar_one() or 0
        batch_num = f"PARTNER-RCTI-{year}-{count + 1:04d}"

        now = utc_now()
        batch = PartnerPayoutBatch(
            id=str(uuid.uuid4()),
            batch_number=batch_num,
            partner_id=req.partner_id,
            status=PayoutBatchStatus.APPROVED,
            period_start=req.period_start,
            period_end=req.period_end,
            total_legs_count=len(legs),
            gross_payout_amount=round(gross_payout, 2),
            gst_amount=gst_amount,
            net_disbursed_amount=net_disbursed,
            rcti_reference=f"RCTI-{partner.abn or 'ABN'}-{batch_num}",
            notes=req.notes,
            disbursed_at=now
        )

        for leg in legs:
            leg.settled_at = now
            leg.settlement_notes = f"Settled in Partner Batch {batch_num}"

        db.add(batch)
        await db.commit()
        await db.refresh(batch)
        return batch
