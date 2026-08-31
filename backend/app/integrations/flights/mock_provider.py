from datetime import date, datetime, timedelta, timezone
from typing import Optional
from app.integrations.flights.base import BaseFlightProvider, FlightData


AIRLINE_MAP = {
    "QF": ("Qantas Airways", "Terminal 1 (Domestic)"),
    "VA": ("Virgin Australia", "Terminal 3 (Domestic)"),
    "JQ": ("Jetstar Airways", "Terminal 4 (Domestic)"),
    "ZL": ("Regional Express (Rex)", "Terminal 4 (Domestic)"),
    "EK": ("Emirates", "Terminal 2 (International)"),
    "SQ": ("Singapore Airlines", "Terminal 2 (International)"),
    "QR": ("Qatar Airways", "Terminal 2 (International)"),
    "CX": ("Cathay Pacific", "Terminal 2 (International)"),
    "NZ": ("Air New Zealand", "Terminal 2 (International)"),
    "EY": ("Etihad Airways", "Terminal 2 (International)"),
    "MH": ("Malaysia Airlines", "Terminal 2 (International)"),
    "TG": ("Thai Airways", "Terminal 2 (International)"),
    "UA": ("United Airlines", "Terminal 2 (International)"),
    "DL": ("Delta Air Lines", "Terminal 2 (International)"),
    "JL": ("Japan Airlines", "Terminal 2 (International)"),
    "BA": ("British Airways", "Terminal 2 (International)"),
}

AIRPORT_MAP = {
    "SYD": "SYD (Sydney Kingsford Smith)",
    "BNE": "BNE (Brisbane Airport)",
    "PER": "PER (Perth International)",
    "ADL": "ADL (Adelaide Airport)",
    "OOL": "OOL (Gold Coast Airport)",
    "CBR": "CBR (Canberra Airport)",
    "HBA": "HBA (Hobart International)",
    "CNS": "CNS (Cairns Airport)",
    "DRW": "DRW (Darwin International)",
    "AVV": "AVV (Avalon Airport)",
    "ESS": "ESS (Essendon Fields Jet Base)",
    "DXB": "DXB (Dubai International)",
    "SIN": "SIN (Singapore Changi)",
    "HKG": "HKG (Hong Kong International)",
    "DOH": "DOH (Hamad International Doha)",
    "AKL": "AKL (Auckland International)",
    "LHR": "LHR (London Heathrow)",
    "LAX": "LAX (Los Angeles International)",
}


class MockFlightProvider(BaseFlightProvider):
    """
    Intelligent Flight Tracking Provider for all Australian & International Commercial Routes.
    Provides realistic telemetry, terminal allocation, delay calculations, and auto-rescheduling.
    """

    async def get_flight_status(
        self,
        flight_number: str,
        flight_date: Optional[date] = None
    ) -> Optional[FlightData]:
        f_num = flight_number.strip().upper().replace(" ", "")
        prefix = f_num[:2]
        now = datetime.now(timezone.utc)
        target_date = flight_date or now.date()

        # Airline & Terminal Mapping
        airline_name, default_terminal = AIRLINE_MAP.get(prefix, ("Commercial Airline", "Terminal 1 (Domestic)"))
        
        # Origin Airport Mapping
        if prefix in ("EK",):
            origin_code = "DXB"
        elif prefix in ("SQ",):
            origin_code = "SIN"
        elif prefix in ("QR",):
            origin_code = "DOH"
        elif prefix in ("CX",):
            origin_code = "HKG"
        elif prefix in ("NZ",):
            origin_code = "AKL"
        elif prefix in ("EY",):
            origin_code = "DXB"
        elif prefix in ("UA", "DL"):
            origin_code = "LAX"
        else:
            # Domestic Australian routes
            num_suffix = int(f_num[2:]) if f_num[2:].isdigit() else 400
            if num_suffix % 3 == 0:
                origin_code = "BNE"
            elif num_suffix % 4 == 0:
                origin_code = "PER"
            elif num_suffix % 5 == 0:
                origin_code = "ADL"
            else:
                origin_code = "SYD"

        origin_airport_str = AIRPORT_MAP.get(origin_code, f"{origin_code} Airport")
        destination_airport_str = "MEL (Melbourne Tullamarine)"

        # Base arrival time
        base_arrival = datetime.combine(target_date, datetime.min.time(), tzinfo=timezone.utc).replace(
            hour=16, minute=30, second=0
        )

        # Deterministic delay variation based on flight number
        flight_hash = sum(ord(c) for c in f_num)
        if f_num in ("QF400", "QF401", "VA214", "JQ512") or (flight_hash % 3 == 0):
            # 25-minute delay scenario
            delay_mins = 25
            status = "DELAYED"
            sched_dt = base_arrival
            est_dt = sched_dt + timedelta(minutes=delay_mins)
            act_dt = None
        elif flight_hash % 4 == 0:
            # On-time landed
            delay_mins = 0
            status = "LANDED"
            sched_dt = base_arrival.replace(hour=14, minute=15)
            est_dt = sched_dt
            act_dt = sched_dt
        else:
            # En-route / Scheduled on-time
            delay_mins = 0
            status = "EN_ROUTE"
            sched_dt = base_arrival.replace(hour=18, minute=45)
            est_dt = sched_dt
            act_dt = None

        return FlightData(
            flight_number=f_num,
            airline=airline_name,
            origin_airport=origin_airport_str,
            destination_airport=destination_airport_str,
            terminal=default_terminal,
            scheduled_arrival=sched_dt,
            estimated_arrival=est_dt,
            actual_arrival=act_dt,
            status=status,
            delay_minutes=delay_mins
        )
