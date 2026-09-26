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
    async def ingest_form(db: AsyncSession, payload: Any, website: Optional[str] = None) -> Tuple["Enquiry", bool]:
        """Store a website/Elementor form submission as a price ENQUIRY.

        These are NOT bookings and never touch the Operate Board — someone is
        only asking for a price. Best-effort field extraction; the full raw
        payload is kept in notes so nothing the customer sent is ever lost.
        """
        from app.models.enquiry import Enquiry

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
        service = WebsiteIngestService._pick(flat, "service")
        vehicle = WebsiteIngestService._pick(flat, "vehicle type", "vehicletype", "vehicle")

        name = (name or "Website enquiry").strip()
        email = (email or "").strip().lower() or None
        phone = (phone or "").strip() or None
        pickup = (pickup or "").strip() or None
        dropoff = (dropoff or "").strip() or None

        # Idempotency: dedupe identical rapid re-submits (Elementor can double-fire).
        sig = hashlib.sha1(
            f"{email}|{pickup}|{dropoff}|{when}|{message}".encode("utf-8", "ignore")
        ).hexdigest()[:12]
        dedup_key = f"form-{sig}"
        existing = (
            await db.execute(select(Enquiry).where(Enquiry.dedup_key == dedup_key))
        ).scalars().first()
        if existing:
            return existing, True

        raw_lines = "\n".join(f"  - {k}: {v}" for k, v in flat.items())
        notes = ""
        if message:
            notes += f"Message: {message}\n"
        notes += f"--- raw website form ---\n{raw_lines}"

        enq = Enquiry(
            website=(website.strip() if website else None),
            dedup_key=dedup_key,
            service_type=service,
            customer_name=name,
            customer_email=email,
            customer_phone=phone,
            pickup_address=(pickup[:500] if pickup else None),
            dropoff_address=(dropoff[:500] if dropoff else None),
            pickup_datetime=when,
            vehicle_category=vehicle,
            notes=notes[:4000],
            status="NEW",
        )
        db.add(enq)
        await db.commit()
        await db.refresh(enq)
        return enq, False

    # ------------------------------------------------------------------ CHBS booking adapter

    @staticmethod
    def _num(v: Any, default: float = 0.0) -> float:
        try:
            return float(str(v).strip())
        except Exception:
            return default

    @staticmethod
    async def ingest_chbs(db: AsyncSession, payload: Any) -> Tuple[Booking, bool]:
        """Create a real, dispatchable booking from a Chauffeur Booking System
        (CHBS) order payload — the exact object the site posts to the partner's
        insert_order. Lands on the Operate Board; the customer is NOT re-notified
        (they already booked and were confirmed on the website). Idempotent on
        the CHBS booking id.
        """
        from app.schemas.booking import BookingCreate, BookingLegCreate
        from app.services.booking_service import BookingService
        from app.models.enums import PaymentStatus

        meta = (payload.get("meta") or {}) if isinstance(payload, dict) else {}
        post = (payload.get("post") or {}) if isinstance(payload, dict) else {}

        ext = str(post.get("ID") or meta.get("booking_id") or "").strip()
        tag = WebsiteIngestService._ref_tag(f"chbs-{ext}") if ext else None
        if tag:
            existing = (
                await db.execute(
                    select(Booking).where(Booking.internal_notes.ilike(f"%{tag}%"))
                    .options(selectinload(Booking.legs), selectinload(Booking.customer))
                )
            ).scalars().first()
            if existing:
                return existing, True

        # Customer
        fn = (meta.get("client_contact_detail_first_name") or "").strip()
        ln = (meta.get("client_contact_detail_last_name") or "").strip()
        name = (f"{fn} {ln}").strip() or "Website booking"
        email = (meta.get("client_contact_detail_email_address") or "").strip().lower() or None
        phone = (meta.get("client_contact_detail_phone_number") or "").strip() or None

        # Pickup / dropoff from the coordinate list (first = pickup, last = dropoff)
        coords = meta.get("coordinate") or []
        pickup_c = coords[0] if coords else {}
        drop_c = coords[-1] if len(coords) > 1 else (coords[0] if coords else {})
        pickup = (pickup_c.get("address") or "See booking notes").strip()
        dropoff = (drop_c.get("address") or "See booking notes").strip()

        # When
        when = WebsiteIngestService._parse_dt(meta.get("pickup_datetime"))
        if when is None:
            d = meta.get("pickup_date")
            t = meta.get("pickup_time")
            when = WebsiteIngestService._parse_dt(f"{d} {t}" if d and t else d)

        # Passengers / luggage
        pax = int(WebsiteIngestService._num(meta.get("passenger_adult_number")) +
                  WebsiteIngestService._num(meta.get("passenger_children_number")))
        if pax <= 0:
            pax = 1
        bags = int(WebsiteIngestService._num(payload.get("vehicle_bag_count") if isinstance(payload, dict) else 0))

        # Fare + paid state
        billing = (payload.get("billing") or {}) if isinstance(payload, dict) else {}
        summary = billing.get("summary") or {}
        total = round(WebsiteIngestService._num(summary.get("pay") or summary.get("value_gross")), 2)
        status_name = str(payload.get("booking_status_name") or "").lower() if isinstance(payload, dict) else ""
        is_paid = ("confirm" in status_name) or ("complet" in status_name)

        # Flight number, if the form captured it
        flight = None
        for f in (meta.get("form_element_field") or []):
            if "flight" in str(f.get("label") or "").lower() and f.get("value"):
                flight = str(f.get("value"))[:20]
                break

        is_airport = "airport" in pickup.lower() or "airport" in dropoff.lower()
        distance_km = WebsiteIngestService._num(meta.get("base_location_distance")) or None
        vehicle_name = (payload.get("vehicle_name") or meta.get("vehicle_name") or "") if isinstance(payload, dict) else ""

        note_bits = [f"[Website booking via CHBS #{ext}]"]
        for label, key in (("service", "service_type_name"), ("transfer", "transfer_type_name"),
                           ("payment", "payment_name"), ("status", "booking_status_name")):
            val = payload.get(key) if isinstance(payload, dict) else None
            if val:
                note_bits.append(f"{label}={val}")
        if vehicle_name:
            note_bits.append(f"vehicle={vehicle_name}")
        if meta.get("comment"):
            note_bits.append(f"| Comment: {meta.get('comment')}")
        if meta.get("coupon_code"):
            note_bits.append(f"| Coupon: {meta.get('coupon_code')}")
        if tag:
            note_bits.append(tag)
        internal_notes = " ".join(note_bits)

        booking_in = BookingCreate(
            customer_name=name,
            customer_email=email,
            customer_phone=phone,
            source=BookingSource.WEBSITE,
            total_fare=total,
            deposit_percentage=100.0,
            flight_tracking_enabled=bool(flight),
            passenger_name=name,
            passenger_phone=phone,
            passenger_email=email,
            passenger_count=pax,
            luggage_count=bags,
            internal_notes=internal_notes[:4000],
            legs=[BookingLegCreate(
                leg_number=1,
                pickup_address=pickup[:500],
                pickup_lat=pickup_c.get("lat"),
                pickup_lng=pickup_c.get("lng"),
                dropoff_address=dropoff[:500],
                dropoff_lat=drop_c.get("lat"),
                dropoff_lng=drop_c.get("lng"),
                pickup_datetime=when or (datetime.now(timezone.utc) + timedelta(days=1)),
                distance_km=distance_km,
                vehicle_category=VehicleCategory.SEDAN_PREMIUM,
                is_airport_pickup=is_airport,
                flight_number=flight,
            )],
        )
        booking = await BookingService.create_booking(db, booking_in, notify=False)

        if is_paid and total > 0:
            booking.paid_amount = total
            booking.calculate_balance()
            booking.payment_status = (
                PaymentStatus.PAID_IN_FULL if booking.balance_amount <= 0 else PaymentStatus.PARTIAL_DEPOSIT
            )
            await db.commit()
            await db.refresh(booking)

        # The website already emails its own confirmation, so we only SMS the
        # customer their dashboard portal (set-password / login) link.
        try:
            from app.services.notification_service import NotificationService
            await NotificationService.send_portal_link_sms(db, booking)
            await db.commit()
        except Exception:
            pass

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
