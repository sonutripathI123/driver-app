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
import hashlib
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.booking import Booking
from app.models.enums import BookingSource, PaymentStatus, VehicleCategory
from app.schemas.website_ingest import WebsiteBookingIngest

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(r"[+()\d][\d\s()\-]{6,}\d")
_TIME_RE = re.compile(r"\b(\d{1,2}:\d{2}\s*(?:[APap][Mm])?)\b")


class WebsiteIngestService:
    @staticmethod
    def _ref_tag(external_reference: str) -> str:
        return f"[web-ref:{external_reference.strip()}]"

    # ------------------------------------------------------------------ lenient form ingest

    @staticmethod
    def _flatten(obj: Any, prefix: str = "") -> Dict[str, str]:
        """Flatten a nested dict/list (e.g. Elementor's fields[x][value]) into
        {dotted.key: string_value}, keeping only leaf scalars."""
        out: Dict[str, str] = {}
        if isinstance(obj, dict):
            for k, v in obj.items():
                out.update(WebsiteIngestService._flatten(v, f"{prefix}.{k}" if prefix else str(k)))
        elif isinstance(obj, (list, tuple)):
            for i, v in enumerate(obj):
                out.update(WebsiteIngestService._flatten(v, f"{prefix}.{i}" if prefix else str(i)))
        elif obj is not None:
            s = str(obj).strip()
            if s:
                out[prefix] = s
        return out

    # Elementor/CF7 metadata keys that are never a customer value.
    _META_KEYS = ("form_name", "form-name", "form name", "form_id", "form-id",
                  "page url", "page_url", "referer", "remote_ip", "queried_id", "post_id")

    @staticmethod
    def _pick(flat: Dict[str, str], *keywords: str) -> Optional[str]:
        """First value whose key contains any of the keywords (case-insensitive).
        Elementor keys look like 'fields.pickuplocations.value', so we match on
        the key path, preferring '...value' leaves over id/title/type. Form
        metadata keys (form_name, page url, …) are never matched."""
        kws = [k.lower() for k in keywords]
        best: Optional[str] = None
        for key, val in flat.items():
            kl = key.lower()
            if any(m in kl for m in WebsiteIngestService._META_KEYS):
                continue
            if any(kw in kl for kw in kws):
                # skip Elementor metadata leaves that aren't the actual value
                if kl.endswith((".id", ".type", ".title", ".raw_value")) and not kl.endswith(".value"):
                    if best is None:
                        best = val
                    continue
                return val
        return best

    @staticmethod
    def _parse_dt(raw: Optional[str]) -> Optional[datetime]:
        if not raw:
            return None
        raw = raw.strip()
        candidates = [
            "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M",
            "%Y-%m-%d", "%d/%m/%Y %H:%M", "%d/%m/%Y", "%d-%m-%Y %H:%M", "%d-%m-%Y",
            "%m/%d/%Y %H:%M", "%m/%d/%Y",
            # Month-name formats (Elementor's date picker sends e.g. "September 23, 2026")
            "%B %d, %Y", "%b %d, %Y", "%B %d %Y", "%b %d %Y",
            "%d %B %Y", "%d %b %Y",
        ]
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except Exception:
            pass
        for fmt in candidates:
            try:
                return datetime.strptime(raw, fmt)
            except Exception:
                continue
        return None

    @staticmethod
    def _parse_time(raw: Optional[str]) -> Optional[Tuple[int, int]]:
        """Return (hour, minute) from a separate time field like '2:30 PM' or '14:30'."""
        if not raw:
            return None
        raw = raw.strip()
        for fmt in ("%I:%M %p", "%I:%M%p", "%H:%M", "%I %p"):
            try:
                t = datetime.strptime(raw, fmt)
                return t.hour, t.minute
            except Exception:
                continue
        return None

    @staticmethod
    async def ingest_form(db: AsyncSession, payload: Any, website: Optional[str] = None) -> Tuple[Booking, bool]:
        """Create a QUOTE-REQUEST booking from a loose website/Elementor form
        payload. Best-effort field extraction; the full raw payload is kept in
        internal_notes so nothing the customer sent is ever lost. The customer
        is NOT auto-notified (the team quotes them first)."""
        from app.schemas.booking import BookingCreate, BookingLegCreate
        from app.services.booking_service import BookingService

        flat = WebsiteIngestService._flatten(payload)

        first = WebsiteIngestService._pick(flat, "first name", "firstname", "first-name")
        last = WebsiteIngestService._pick(flat, "last name", "lastname", "last-name")
        if first or last:
            name = " ".join(p for p in (first, last) if p)
        else:
            name = WebsiteIngestService._pick(flat, "name", "your-name", "fullname") or "Website enquiry"
        email = WebsiteIngestService._pick(flat, "email", "e-mail")
        if not email:
            # last resort: scan all values for something that looks like an email
            for v in flat.values():
                m = _EMAIL_RE.search(v)
                if m:
                    email = m.group(0)
                    break
        phone = WebsiteIngestService._pick(flat, "phone", "mobile", "tel", "contact-number")
        if not phone:
            for k, v in flat.items():
                if "email" in k.lower():
                    continue
                m = _PHONE_RE.search(v)
                if m:
                    phone = m.group(0).strip()
                    break
        pickup = WebsiteIngestService._pick(flat, "pickup", "pick-up", "from", "origin", "collection")
        dropoff = WebsiteIngestService._pick(flat, "dropoff", "drop-off", "drop", "destination", "to")
        # Date — keyed field first, else scan every value for a date-looking one.
        when = WebsiteIngestService._parse_dt(
            WebsiteIngestService._pick(flat, "datetime", "pickup_date", "pickupdate", "date", "when")
        )
        if when is None:
            for k, v in flat.items():
                kl = k.lower()
                if "email" in kl or "phone" in kl or "mobile" in kl:
                    continue
                d = WebsiteIngestService._parse_dt(v)
                if d is not None:
                    when = d
                    break
        # Time — keyed field first, else scan every value for a HH:MM (am/pm) token.
        hm = WebsiteIngestService._parse_time(
            WebsiteIngestService._pick(flat, "pickup_time", "pickuptime", "time")
        )
        if hm is None:
            for v in flat.values():
                m = _TIME_RE.search(v)
                if m:
                    hm = WebsiteIngestService._parse_time(m.group(1))
                    if hm is not None:
                        break
        if when is not None and hm is not None:
            when = when.replace(hour=hm[0], minute=hm[1])
        message = WebsiteIngestService._pick(flat, "message", "note", "comment", "detail", "requirement")

        # TEMP DEBUG (remove after time mapping confirmed).
        try:
            import logging
            logging.getLogger("website_ingest").warning(
                "WEBSITE_FORM_DEBUG time_raw=%r hm=%s when=%s",
                WebsiteIngestService._pick(flat, "pickup_time", "pickuptime", "time"), hm, when,
            )
        except Exception:
            pass

        # Sensible fallbacks so create_booking's required fields are satisfied.
        email = (email or "no-email@website-enquiry.local").strip().lower()
        phone = (phone or "+61000000000").strip()
        pickup = (pickup or "See enquiry notes").strip()
        dropoff = (dropoff or "See enquiry notes").strip()
        pickup_dt = when or (datetime.now(timezone.utc) + timedelta(days=2))

        # Idempotency: dedupe identical rapid re-submits (Elementor can double-fire).
        sig = hashlib.sha1(
            f"{email}|{pickup}|{dropoff}|{when}|{message}".encode("utf-8", "ignore")
        ).hexdigest()[:10]
        tag = WebsiteIngestService._ref_tag(f"form-{sig}")
        existing = (
            await db.execute(
                select(Booking).where(Booking.internal_notes.ilike(f"%{tag}%"))
                .options(selectinload(Booking.legs), selectinload(Booking.customer))
            )
        ).scalars().first()
        if existing:
            return existing, True

        raw_lines = "\n".join(f"  - {k}: {v}" for k, v in flat.items())
        note = "[QUOTE REQUEST]"
        if website:
            note += f" [via {website.strip()}]"
        if message:
            note += f"\nMessage: {message}"
        note += f"\n--- raw website form ---\n{raw_lines}\n{tag}"

        booking_in = BookingCreate(
            customer_name=name,
            customer_email=email,
            customer_phone=phone,
            source=BookingSource.WEBSITE,
            total_fare=0.0,
            deposit_percentage=100.0,
            passenger_name=name,
            passenger_phone=phone,
            passenger_email=email,
            internal_notes=note[:4000],
            legs=[BookingLegCreate(
                leg_number=1,
                pickup_address=pickup[:500],
                dropoff_address=dropoff[:500],
                pickup_datetime=pickup_dt,
                vehicle_category=VehicleCategory.SEDAN_PREMIUM,
            )],
        )
        booking = await BookingService.create_booking(db, booking_in, notify=False)
        return booking, False

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
