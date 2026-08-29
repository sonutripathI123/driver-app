import json
import logging
from typing import Any, Dict, List
from app.core.config import settings

logger = logging.getLogger(__name__)

# In-Memory singleton of active browser push subscriptions (Google FCM / Apple APNs)
ACTIVE_SUBSCRIPTIONS: List[Dict[str, Any]] = []


class WebPushGateway:
    """
    Web Push Dispatcher delivering real-time OS-level push notifications
    directly to Android Chrome, iOS Safari, and Desktop Chrome via Google FCM / Apple APNs
    using the standard VAPID Web Push Protocol.
    """

    @staticmethod
    def register_subscription(subscription: Dict[str, Any]) -> bool:
        """Saves a browser push subscription for background dispatch."""
        endpoint = subscription.get("endpoint")
        if not endpoint:
            return False

        # Remove duplicate endpoint if exists
        for i, sub in enumerate(ACTIVE_SUBSCRIPTIONS):
            if sub.get("endpoint") == endpoint:
                ACTIVE_SUBSCRIPTIONS[i] = subscription
                logger.info(f"[WEBPUSH] Updated existing subscription: {endpoint[:40]}...")
                return True

        ACTIVE_SUBSCRIPTIONS.append(subscription)
        logger.info(f"[WEBPUSH] Registered new subscription (Total: {len(ACTIVE_SUBSCRIPTIONS)}): {endpoint[:40]}...")
        return True

    @staticmethod
    def get_public_key() -> str:
        return settings.VAPID_PUBLIC_KEY

    @staticmethod
    def send_push_to_all(title: str, body: str, url: str = "/") -> int:
        """
        Sends cryptographic VAPID push payload to all registered mobile/desktop browsers.
        Google FCM and Apple APNs deliver this to the device hardware even when browser is closed.
        """
        if not ACTIVE_SUBSCRIPTIONS:
            logger.info("[WEBPUSH] No active device subscriptions registered yet.")
            return 0

        payload = json.dumps({
            "title": title,
            "body": body,
            "url": url,
            "icon": "/favicon.svg",
            "badge": "/favicon.svg",
            "vibrate": [200, 100, 200, 100, 400]
        })

        success_count = 0
        dead_subscriptions = []

        try:
            from pywebpush import webpush, WebPushException
        except ImportError:
            logger.warning("[WEBPUSH] pywebpush library not loaded.")
            return 0

        for sub in ACTIVE_SUBSCRIPTIONS:
            try:
                webpush(
                    subscription_info=sub,
                    data=payload,
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": settings.VAPID_CLAIMS_EMAIL},
                    timeout=8.0
                )
                success_count += 1
                logger.info(f"[WEBPUSH SENT] Successfully dispatched to device {sub.get('endpoint', '')[:30]}...")
            except WebPushException as ex:
                logger.error(f"[WEBPUSH EXCEPTION] {str(ex)}")
                # If endpoint is expired/unsubscribed (HTTP 410 or 404), mark for cleanup
                if ex.response and ex.response.status_code in (404, 410):
                    dead_subscriptions.append(sub)
            except Exception as e:
                logger.error(f"[WEBPUSH ERROR] {str(e)}")

        # Clean up dead/expired subscriptions
        for dead in dead_subscriptions:
            if dead in ACTIVE_SUBSCRIPTIONS:
                ACTIVE_SUBSCRIPTIONS.remove(dead)

        return success_count


webpush_gateway = WebPushGateway()
