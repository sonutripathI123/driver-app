"""Shared helpers for flight provider responses.

Providers return timestamps in several shapes, so parsing lives here rather
than being repeated (and diverging) in each provider.
"""
from datetime import datetime, timezone
from typing import Any, Dict, Optional


def parse_dt(value: Optional[str]) -> Optional[datetime]:
    """
    Parses a provider timestamp into an aware UTC datetime, or None.

    Handles the formats seen across providers:
      2026-09-08T10:10:00Z            (FlightAware, AviationStack)
      2026-09-08T10:10:00+00:00       (AviationStack)
      2026-09-08 10:10Z               (AeroDataBox 'utc')
      2026-09-08 10:10+10:00          (AeroDataBox 'local')

    Returns None rather than guessing: a wrong arrival time is worse than none,
    because the dispatch service reschedules pickups from these values.
    """
    if not value or not isinstance(value, str):
        return None

    text = value.strip()
    if not text:
        return None

    # AeroDataBox uses a space separator and may omit seconds.
    normalised = text.replace(" ", "T", 1) if " " in text[:11] else text
    if normalised.endswith("Z"):
        normalised = normalised[:-1] + "+00:00"

    for candidate in (normalised, f"{normalised}:00"):
        try:
            parsed = datetime.fromisoformat(candidate)
        except ValueError:
            continue
        # A provider that omits the offset is documented as UTC.
        return parsed.astimezone(timezone.utc) if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)

    return None


def first_str(source: Dict[str, Any], *paths: str) -> Optional[str]:
    """
    Returns the first non-empty string at any of the given dotted paths.

    Provider payloads move fields between releases, so callers list the
    alternatives they know about instead of assuming one shape.
    """
    for path in paths:
        node: Any = source
        for part in path.split("."):
            if not isinstance(node, dict):
                node = None
                break
            node = node.get(part)
        if isinstance(node, str) and node.strip():
            return node.strip()
    return None


def delay_minutes(scheduled: Optional[datetime], estimated: Optional[datetime]) -> int:
    """Minutes late, never negative — an early arrival is not a delay."""
    if not scheduled or not estimated:
        return 0
    return max(0, int((estimated - scheduled).total_seconds() // 60))
