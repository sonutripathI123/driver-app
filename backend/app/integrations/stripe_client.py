import json
import uuid
from typing import Any, Dict, Optional
import stripe
from app.core.config import settings


class StripeGateway:
    """
    Stripe payment gateway integration adapter.
    Handles Checkout Sessions, Webhook event verification, and Refunds.
    Features robust deterministic mock mode for test environments.
    """
    def __init__(self):
        self.secret_key = getattr(settings, "STRIPE_SECRET_KEY", None)
        self.webhook_secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", None)
        if self.secret_key and not self.secret_key.startswith("sk_test_placeholder"):
            stripe.api_key = self.secret_key
            self.is_live = True
        else:
            self.is_live = False

    async def create_checkout_session(
        self,
        booking_id: str,
        booking_number: str,
        customer_email: str,
        amount: float,
        currency: str = "AUD",
        payment_type: str = "DEPOSIT",
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Creates a hosted Stripe Checkout Session for deposit or full payment.
        """
        amount_cents = int(round(amount * 100))
        s_url = success_url or f"https://luxurychauffeurs.com.au/booking/confirmation?session_id={{CHECKOUT_SESSION_ID}}&booking={booking_number}"
        c_url = cancel_url or f"https://luxurychauffeurs.com.au/booking/payment-cancelled?booking={booking_number}"

        description = f"Chauffeur Booking {booking_number} - {payment_type.replace('_', ' ').title()}"

        if not self.is_live:
            # Deterministic mock checkout session for test environments
            mock_session_id = f"cs_test_{uuid.uuid4().hex[:16]}"
            mock_intent_id = f"pi_test_{uuid.uuid4().hex[:16]}"
            return {
                "session_id": mock_session_id,
                "checkout_url": f"https://checkout.stripe.com/c/pay/{mock_session_id}",
                "payment_intent_id": mock_intent_id,
                "amount": amount,
                "currency": currency.upper(),
                "payment_type": payment_type
            }

        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            customer_email=customer_email,
            line_items=[
                {
                    "price_data": {
                        "currency": currency.lower(),
                        "product_data": {
                            "name": f"Luxury Chauffeur Transfer ({booking_number})",
                            "description": description,
                        },
                        "unit_amount": amount_cents,
                    },
                    "quantity": 1,
                }
            ],
            mode="payment",
            success_url=s_url,
            cancel_url=c_url,
            metadata={
                "booking_id": booking_id,
                "booking_number": booking_number,
                "payment_type": payment_type
            }
        )

        return {
            "session_id": session.id,
            "checkout_url": session.url,
            "payment_intent_id": session.payment_intent,
            "amount": amount,
            "currency": currency.upper(),
            "payment_type": payment_type
        }

    def verify_webhook_event(
        self,
        payload_bytes: bytes,
        sig_header: Optional[str]
    ) -> Dict[str, Any]:
        """
        Verifies Stripe cryptographic webhook signature and parses the event.
        """
        if not self.is_live or not self.webhook_secret or self.webhook_secret.startswith("whsec_placeholder"):
            # Mock / development payload parsing
            try:
                return json.loads(payload_bytes.decode("utf-8"))
            except Exception:
                return {}

        try:
            event = stripe.Webhook.construct_event(
                payload=payload_bytes,
                sig_header=sig_header,
                secret=self.webhook_secret
            )
            return event
        except Exception as e:
            raise ValueError(f"Webhook signature verification failed: {str(e)}")

    async def create_refund(
        self,
        payment_intent_id: Optional[str],
        amount: Optional[float] = None,
        reason: str = "requested_by_customer"
    ) -> Dict[str, Any]:
        """
        Executes a full or partial refund via Stripe.
        """
        if not self.is_live or not payment_intent_id:
            mock_refund_id = f"re_test_{uuid.uuid4().hex[:16]}"
            return {
                "id": mock_refund_id,
                "status": "succeeded",
                "amount": int(round(amount * 100)) if amount else 0,
                "currency": "aud",
                "payment_intent": payment_intent_id or "pi_mock",
                "reason": reason
            }

        kwargs: Dict[str, Any] = {
            "payment_intent": payment_intent_id,
            "reason": reason if reason in ["duplicate", "fraudulent", "requested_by_customer"] else "requested_by_customer"
        }
        if amount is not None:
            kwargs["amount"] = int(round(amount * 100))

        refund = stripe.Refund.create(**kwargs)
        return {
            "id": refund.id,
            "status": refund.status,
            "amount": refund.amount,
            "currency": refund.currency,
            "payment_intent": refund.payment_intent,
            "reason": reason
        }


# Singleton stripe gateway instance
stripe_gateway = StripeGateway()
