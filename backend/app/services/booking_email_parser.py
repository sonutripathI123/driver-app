"""
Turn a booking-confirmation email into a dispatchable booking.

All three sites' booking confirmations land in one inbox. Each uses a different
layout (a CHBS plugin, a plain-text operator template, and Civitatis), so this
module detects which one an email is by signatures in its body and extracts the
same canonical fields from each. The fields are handed to
WebsiteIngestService.ingest_form(..., as_booking=True), which builds the real
booking (idempotent, so re-polling the same email never duplicates it).

A quote enquiry or any other email matches no signature and is left alone — it
just stays in the inbox and never becomes a booking.
"""
import re
from typing import Dict, List, Optional, Tuple

# Canonical keys WebsiteIngestService.ingest_form / _form_to_booking recognise.
# name, phone, email, pickup, dropoff, datetime, total, flight, passengers

CHBS_SITE = "melbourneairportchauffeurservice.com.au"
CORPORATE_SITE = "corporatecarsmelbourne.com.au"
OPAL_SITE = "opalchauffeurs.com.au"


def _kv_and_lines(body: str) -> Tuple[Dict[str, str], List[str]]:
    """Build {label_lower: value} from 'Label: value' or 'Label<TAB>value' lines."""
    kv: Dict[str, str] = {}
    lines = [ln.rstrip() for ln in (body or "").splitlines()]
    for line in lines:
        if "\t" in line:
            k, _, v = line.partition("\t")
        elif ":" in line:
            k, _, v = line.partition(":")
        else:
            continue
        k = k.strip().lower()
        v = v.strip()
        if k and v and k not in kv:
            kv[k] = v
    return kv, lines


def _parse_chbs(body: str) -> Dict[str, str]:
    kv, lines = _kv_and_lines(body)
    out: Dict[str, str] = {}
    name = f"{kv.get('first name', '')} {kv.get('last name', '')}".strip()
    if name:
        out["name"] = name
    if kv.get("phone number"):
        out["phone"] = kv["phone number"]
    if kv.get("e-mail address"):
        out["email"] = kv["e-mail address"]
    if kv.get("pickup date and time"):
        out["datetime"] = kv["pickup date and time"]
    if kv.get("order total amount"):
        out["total"] = kv["order total amount"]
    if kv.get("flight details"):
        out["flight"] = kv["flight details"]
    if kv.get("passengers count"):
        out["passengers"] = kv["passengers count"]
    # "Route locations" is a header; the next two non-empty lines are the
    # pickup and dropoff addresses (no label of their own).
    for i, ln in enumerate(lines):
        if ln.strip().lower() == "route locations":
            addrs = [x.strip() for x in lines[i + 1:i + 5] if x.strip()][:2]
            if addrs:
                out["pickup"] = addrs[0]
            if len(addrs) > 1:
                out["dropoff"] = addrs[1]
            break
    return out


def _parse_corporate(body: str) -> Dict[str, str]:
    kv, _ = _kv_and_lines(body)
    out: Dict[str, str] = {}
    m = re.search(r"\bHi\s+([A-Z][A-Za-z'’\-\. ]{1,60}?)\s*,", body or "")
    if m:
        out["name"] = m.group(1).strip()
    if kv.get("pick-up"):
        out["pickup"] = kv["pick-up"]
    if kv.get("drop-off"):
        out["dropoff"] = kv["drop-off"]
    if kv.get("date & time"):
        out["datetime"] = kv["date & time"].replace(" at ", " ")
    return out


def _parse_civitatis(body: str) -> Dict[str, str]:
    kv, _ = _kv_and_lines(body)
    out: Dict[str, str] = {}
    full = f"{kv.get('name', '')} {kv.get('surname', '')}".strip()
    if full:
        out["name"] = full
    if kv.get("number of passengers"):
        out["passengers"] = kv["number of passengers"]
    if kv.get("airline and flight number"):
        out["flight"] = kv["airline and flight number"]
    price = kv.get("net price") or kv.get("transfer") or ""
    pm = re.search(r"([\d,]+(?:\.\d+)?)\s*AUD", price)
    if pm:
        out["total"] = pm.group(1)
    d = kv.get("date", "")
    h = kv.get("hour", "")
    hm = re.search(r"(\d{1,2}:\d{2})", h)
    dt = f"{d} {hm.group(1) if hm else ''}".strip()
    if dt:
        out["datetime"] = dt
    transfer = kv.get("transfer", "")
    if " - " in transfer:
        out["pickup"] = transfer.split(" - ", 1)[0].strip()
    dest = kv.get("hotel or other destination")
    if dest:
        out["dropoff"] = dest
    return out


def parse_booking_email(subject: str, body: str, sender: str = "") -> Optional[Tuple[Dict[str, str], str]]:
    """Detect a booking confirmation and return (canonical_fields, website), or
    None if the email is not a recognised booking confirmation."""
    b = body or ""
    bl = b.lower()
    snd = (sender or "").lower()

    # Civitatis (Opal's inbound marketplace bookings). Check first — its subject
    # also contains "new booking".
    if "civitatis" in snd or ("reservation number" in bl and "transfer" in bl):
        fields = _parse_civitatis(b)
        return (fields, OPAL_SITE) if (fields.get("pickup") or fields.get("dropoff")) else None

    # Melbourne CHBS plugin.
    if "route locations" in bl and "order total amount" in bl:
        fields = _parse_chbs(b)
        return (fields, CHBS_SITE) if (fields.get("pickup") or fields.get("dropoff")) else None

    # Corporate plain-text operator template.
    if "booking number" in bl and ("pick-up" in bl or "pick up" in bl):
        fields = _parse_corporate(b)
        return (fields, CORPORATE_SITE) if (fields.get("pickup") or fields.get("dropoff")) else None

    return None
