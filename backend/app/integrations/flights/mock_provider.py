from datetime import date, datetime, timedelta, timezone
from typing import Optional
from app.integrations.flights.base import BaseFlightProvider, FlightData


class MockFlightProvider(BaseFlightProvider):
    """
    Deterministic Flight Tracking Provider for development and test suites.
    """

    async def get_flight_status(
        self,
        flight_number: str,
        flight_date: Optional[date] = None
    ) -> Optional[FlightData]:
        f_num = flight_number.strip().upper().replace(" ", "")
        now = datetime.now(timezone.utc)
        target_date = flight_date or now.date()
        base_arrival = datetime.combine(target_date, datetime.min.time(), tzinfo=timezone.utc).replace(
            hour=14, minute=0, second=0
        )

        if f_num == "QF401":
            # Qantas Sydney to Melbourne (Delayed +45m)
            sched = base_arrival
            est = sched + timedelta(minutes=45)
            return FlightData(
                flight_number="QF401",
                airline="Qantas",
                origin_airport="SYD",
                destination_airport="MEL",
                terminal="Terminal 1 (Domestic)",
                scheduled_arrival=sched,
                estimated_arrival=est,
                actual_arrival=None,
                status="DELAYED",
                delay_minutes=45
            )
        elif f_num == "EK406":
            # Emirates Dubai to Melbourne (Landed On Time)
            sched = base_arrival.replace(hour=18, minute=30)
            return FlightData(
                flight_number="EK406",
                airline="Emirates",
                origin_airport="DXB",
                destination_airport="MEL",
                terminal="Terminal 2 (International)",
                scheduled_arrival=sched,
                estimated_arrival=sched,
                actual_arrival=sched,
                status="LANDED",
                delay_minutes=0
            )
        elif f_num == "VA820":
            # Virgin Australia Sydney to Melbourne (Early -15m)
            sched = base_arrival.replace(hour=11, minute=15)
            est = sched - timedelta(minutes=15)
            return FlightData(
                flight_number="VA820",
                airline="Virgin Australia",
                origin_airport="SYD",
                destination_airport="MEL",
                terminal="Terminal 3 (Domestic)",
                scheduled_arrival=sched,
                estimated_arrival=est,
                actual_arrival=None,
                status="EN_ROUTE",
                delay_minutes=-15
            )
        elif f_num == "CX105":
            # Cathay Pacific Hong Kong to Melbourne (Cancelled)
            sched = base_arrival.replace(hour=21, minute=0)
            return FlightData(
                flight_number="CX105",
                airline="Cathay Pacific",
                origin_airport="HKG",
                destination_airport="MEL",
                terminal="Terminal 2 (International)",
                scheduled_arrival=sched,
                estimated_arrival=sched,
                actual_arrival=None,
                status="CANCELLED",
                delay_minutes=0
            )
        else:
            # Generic fallback flight
            return FlightData(
                flight_number=f_num,
                airline="Commercial Airline",
                origin_airport="SYD",
                destination_airport="MEL",
                terminal="Terminal 1",
                scheduled_arrival=base_arrival,
                estimated_arrival=base_arrival,
                actual_arrival=None,
                status="SCHEDULED",
                delay_minutes=0
            )
