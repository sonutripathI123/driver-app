import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import DateTime, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AppSetting(Base):
    """
    Durable store for operator-editable platform configuration.

    Settings such as the manager alert preferences were held in a module-level
    dict, so every change was lost when the service restarted — which on the
    hosting free tier happens routinely. Kept as a key/JSON pair so new
    settings do not each need a migration.
    """
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(
        String(100),
        primary_key=True,
        index=True
    )
    value: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False
    )
    updated_by: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
