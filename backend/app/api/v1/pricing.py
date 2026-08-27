from typing import Any, Dict, List
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.rbac import require_admin, require_staff
from app.models.pricing import AirportRouteRule, PricingRule, SurchargeRule
from app.schemas.pricing import (
    AirportRouteRuleCreate,
    AirportRouteRuleRead,
    SurchargeRuleCreate,
    SurchargeRuleRead,
)
from app.services.pricing_service import DEFAULT_CATEGORY_CONFIGS

router = APIRouter(prefix="/pricing", tags=["Pricing Configuration"])


@router.get("/categories", dependencies=[Depends(require_staff)])
async def get_category_pricing_matrix():
    """
    Get default category pricing parameters and vehicle capabilities.
    """
    matrix: Dict[str, Any] = {}
    for cat, conf in DEFAULT_CATEGORY_CONFIGS.items():
        matrix[cat.value] = conf
    return matrix


@router.get("/airport-routes", response_model=List[AirportRouteRuleRead], dependencies=[Depends(require_staff)])
async def list_airport_route_rules(db: AsyncSession = Depends(get_db)):
    """
    List configured Airport All-Inclusive Route rules.
    """
    stmt = select(AirportRouteRule).order_by(AirportRouteRule.created_at.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.post("/airport-routes", response_model=AirportRouteRuleRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def create_airport_route_rule(
    rule_in: AirportRouteRuleCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new fixed Airport All-Inclusive route rule.
    Access: ADMIN only
    """
    rule = AirportRouteRule(
        route_name=rule_in.route_name.strip(),
        origin_keyword=rule_in.origin_keyword.strip().lower(),
        destination_keyword=rule_in.destination_keyword.strip().lower(),
        vehicle_category=rule_in.vehicle_category,
        all_inclusive_fare=rule_in.all_inclusive_fare,
        tolls_included=rule_in.tolls_included,
        airport_fee_included=rule_in.airport_fee_included,
        is_active=rule_in.is_active
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.get("/surcharges", response_model=List[SurchargeRuleRead], dependencies=[Depends(require_staff)])
async def list_surcharge_rules(db: AsyncSession = Depends(get_db)):
    """
    List configured peak/event/late-night surcharge rules.
    """
    stmt = select(SurchargeRule).order_by(SurchargeRule.created_at.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.post("/surcharges", response_model=SurchargeRuleRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def create_surcharge_rule(
    surcharge_in: SurchargeRuleCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create event/date/time surcharge rule.
    Access: ADMIN only
    """
    rule = SurchargeRule(
        name=surcharge_in.name.strip(),
        surcharge_type=surcharge_in.surcharge_type,
        amount=surcharge_in.amount,
        start_time=surcharge_in.start_time,
        end_time=surcharge_in.end_time,
        start_date=surcharge_in.start_date,
        end_date=surcharge_in.end_date,
        is_active=surcharge_in.is_active
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule
