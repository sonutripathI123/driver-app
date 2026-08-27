from datetime import datetime, time, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.integrations.maps.base import RouteDetails
from app.models.enums import VehicleCategory
from app.models.pricing import AirportRouteRule, PricingRule, SurchargeRule
from app.schemas.pricing import QuoteOption


DEFAULT_CATEGORY_CONFIGS = {
    VehicleCategory.SEDAN_PREMIUM: {
        "name": "Premium Sedan (Mercedes E-Class / Audi A6)",
        "base_fee": 50.0,
        "minimum_fare": 75.0,
        "per_km_tier1": 3.30,
        "tier1_threshold": 25.0,
        "per_km_tier2": 2.80,
        "per_minute": 0.80,
        "airport_fee": 25.0,
        "passenger_capacity": 3,
        "luggage_capacity": 2,
        "payout_ratio": 0.65,
    },
    VehicleCategory.SEDAN_EXECUTIVE: {
        "name": "Executive First Class (Mercedes S-Class / BMW 7)",
        "base_fee": 65.0,
        "minimum_fare": 95.0,
        "per_km_tier1": 4.00,
        "tier1_threshold": 25.0,
        "per_km_tier2": 3.40,
        "per_minute": 1.00,
        "airport_fee": 25.0,
        "passenger_capacity": 3,
        "luggage_capacity": 3,
        "payout_ratio": 0.65,
    },
    VehicleCategory.SUV_PREMIUM: {
        "name": "Premium SUV (Audi Q7 / Lexus RX)",
        "base_fee": 70.0,
        "minimum_fare": 110.0,
        "per_km_tier1": 4.20,
        "tier1_threshold": 25.0,
        "per_km_tier2": 3.60,
        "per_minute": 0.90,
        "airport_fee": 25.0,
        "passenger_capacity": 6,
        "luggage_capacity": 4,
        "payout_ratio": 0.65,
    },
    VehicleCategory.PEOPLE_MOVER: {
        "name": "Executive Van (Mercedes V-Class)",
        "base_fee": 85.0,
        "minimum_fare": 130.0,
        "per_km_tier1": 4.80,
        "tier1_threshold": 25.0,
        "per_km_tier2": 4.00,
        "per_minute": 1.00,
        "airport_fee": 30.0,
        "passenger_capacity": 7,
        "luggage_capacity": 7,
        "payout_ratio": 0.68,
    },
    VehicleCategory.MINIBUS: {
        "name": "Luxury Minibus (Mercedes Sprinter)",
        "base_fee": 150.0,
        "minimum_fare": 220.0,
        "per_km_tier1": 6.50,
        "tier1_threshold": 25.0,
        "per_km_tier2": 5.50,
        "per_minute": 1.50,
        "airport_fee": 40.0,
        "passenger_capacity": 11,
        "luggage_capacity": 12,
        "payout_ratio": 0.70,
    }
}


def ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class PricingEngine:
    @staticmethod
    async def match_airport_route_rule(
        db: AsyncSession,
        origin: str,
        destination: str,
        category: VehicleCategory
    ) -> Optional[AirportRouteRule]:
        """
        Matches Airport-to-City All-Inclusive Route Rules.
        """
        norm_orig = origin.lower()
        norm_dest = destination.lower()

        stmt = select(AirportRouteRule).where(
            AirportRouteRule.is_active == True,
            AirportRouteRule.vehicle_category == category
        )
        result = await db.execute(stmt)
        rules = result.scalars().all()

        for r in rules:
            orig_kw = r.origin_keyword.lower()
            dest_kw = r.destination_keyword.lower()
            if (orig_kw in norm_orig and dest_kw in norm_dest) or (orig_kw in norm_dest and dest_kw in norm_orig):
                return r

        # Built-in Default Airport All-Inclusive Fallback for Melbourne
        if ("airport" in norm_orig and ("cbd" in norm_dest or "melbourne" in norm_dest or "collins" in norm_dest)) or \
           ("airport" in norm_dest and ("cbd" in norm_orig or "melbourne" in norm_orig or "collins" in norm_orig)):
            fare_table = {
                VehicleCategory.SEDAN_PREMIUM: 130.0,
                VehicleCategory.SEDAN_EXECUTIVE: 165.0,
                VehicleCategory.SUV_PREMIUM: 160.0,
                VehicleCategory.PEOPLE_MOVER: 195.0,
                VehicleCategory.MINIBUS: 280.0,
            }
            return AirportRouteRule(
                route_name="Melbourne Airport <-> Melbourne CBD All-Inclusive",
                origin_keyword="airport",
                destination_keyword="cbd",
                vehicle_category=category,
                all_inclusive_fare=fare_table.get(category, 140.0),
                tolls_included=True,
                airport_fee_included=True
            )

        return None

    @staticmethod
    async def calculate_category_fare(
        db: AsyncSession,
        category: VehicleCategory,
        route: RouteDetails,
        pickup_dt: datetime,
        origin_address: str,
        destination_address: str
    ) -> QuoteOption:
        """
        Calculates quote pricing for a single vehicle category using all configurable rules.
        """
        now = datetime.now(timezone.utc)
        safe_pickup = ensure_utc(pickup_dt)
        hours_until_pickup = (safe_pickup - now).total_seconds() / 3600.0
        days_until_pickup = (safe_pickup - now).total_seconds() / 86400.0

        is_airport = "airport" in origin_address.lower() or "airport" in destination_address.lower()

        defaults = DEFAULT_CATEGORY_CONFIGS.get(category, DEFAULT_CATEGORY_CONFIGS[VehicleCategory.SEDAN_PREMIUM])

        # 1. Check for Airport-to-City All-Inclusive Rule
        airport_rule = await PricingEngine.match_airport_route_rule(
            db, origin_address, destination_address, category
        )

        breakdown: Dict[str, Any] = {
            "distance_km": route.distance_km,
            "duration_minutes": route.duration_minutes,
            "category": category.value,
        }

        if airport_rule:
            fare = airport_rule.all_inclusive_fare
            breakdown.update({
                "fare_type": "AIRPORT_ALL_INCLUSIVE",
                "route_name": airport_rule.route_name,
                "all_inclusive_base": fare,
                "tolls_included": airport_rule.tolls_included,
                "tolls_added_separately": 0.0,
                "airport_fee_included": airport_rule.airport_fee_included,
                "airport_fee_added_separately": 0.0,
            })
        else:
            # 2. Banded Calculation
            base_fee = defaults["base_fee"]
            tier1_km = min(route.distance_km, defaults["tier1_threshold"])
            tier2_km = max(0.0, route.distance_km - defaults["tier1_threshold"])

            dist_cost_tier1 = round(tier1_km * defaults["per_km_tier1"], 2)
            dist_cost_tier2 = round(tier2_km * defaults["per_km_tier2"], 2)
            time_cost = round(route.duration_minutes * defaults["per_minute"], 2)

            airport_fee = defaults["airport_fee"] if is_airport else 0.0
            tolls = route.toll_amount_estimated if route.tolls_detected else 0.0

            # Deadhead if > 50km
            deadhead_km = max(0.0, route.distance_km - 50.0)
            deadhead_cost = round(deadhead_km * 2.00, 2)

            subtotal = base_fee + dist_cost_tier1 + dist_cost_tier2 + time_cost + airport_fee + tolls + deadhead_cost
            fare = max(subtotal, defaults["minimum_fare"])

            breakdown.update({
                "fare_type": "STANDARD_BANDED",
                "base_fee": base_fee,
                "tier1_km": tier1_km,
                "tier1_cost": dist_cost_tier1,
                "tier2_km": tier2_km,
                "tier2_cost": dist_cost_tier2,
                "time_cost": time_cost,
                "airport_fee": airport_fee,
                "tolls_added_separately": tolls,
                "tolls_included": False,
                "deadhead_km": deadhead_km,
                "deadhead_cost": deadhead_cost,
                "minimum_fare_applied": fare == defaults["minimum_fare"]
            })

        # 3. Apply Time/Event Surcharges (e.g. Late Night 23:00 - 05:00)
        pickup_time = pickup_dt.time()
        is_late_night = pickup_time >= time(23, 0) or pickup_time < time(5, 0)
        surcharge_amount = 0.0
        surcharge_label = "None"

        if is_late_night:
            surcharge_amount = round(fare * 0.20, 2)  # 20% Late Night Uplift
            surcharge_label = "Late Night Surcharge (23:00 - 05:00) [20%]"

        total_fare = round(fare + surcharge_amount, 2)
        breakdown["surcharge_label"] = surcharge_label
        breakdown["surcharge_amount"] = surcharge_amount
        breakdown["total_fare"] = total_fare

        # 4. Instant Booking Eligibility vs Enquiry Required
        if category == VehicleCategory.MINIBUS:
            eligibility = "ENQUIRY_REQUIRED"
        elif hours_until_pickup < 2.0:
            eligibility = "ENQUIRY_REQUIRED"  # Ultra short notice (< 2h)
        elif route.distance_km > 120.0:
            eligibility = "ENQUIRY_REQUIRED"  # Long distance/regional
        else:
            eligibility = "INSTANT_BOOKING"

        # 5. Verification Gate (High value >= $1000 or pickup < 12h)
        requires_verification = (total_fare >= 1000.0) or (hours_until_pickup < 12.0)

        # 6. Payment Deposit Rules
        if days_until_pickup >= 7.0:
            deposit_pct = 20.0
        else:
            deposit_pct = 100.0

        deposit_req = round(total_fare * (deposit_pct / 100.0), 2)
        driver_payout = round(total_fare * defaults["payout_ratio"], 2)

        return QuoteOption(
            vehicle_category=category,
            vehicle_name=defaults["name"],
            passenger_capacity=defaults["passenger_capacity"],
            luggage_capacity=defaults["luggage_capacity"],
            total_fare=total_fare,
            deposit_required=deposit_req,
            deposit_percentage=deposit_pct,
            pricing_breakdown=breakdown,
            eligibility=eligibility,
            requires_verification=requires_verification,
            allocation_cost_estimate=driver_payout
        )
