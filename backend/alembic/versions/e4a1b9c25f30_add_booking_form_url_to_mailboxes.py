"""add booking_form_url to mailboxes

Revision ID: e4a1b9c25f30
Revises: c7d2e4f8a915
Create Date: 2026-09-22

Each connected mailbox belongs to one website; this stores that website's
public booking-form link so a reply can point the customer at the form that
already handles booking and payment.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'e4a1b9c25f30'
down_revision: Union[str, None] = 'c7d2e4f8a915'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('mailboxes', sa.Column('booking_form_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('mailboxes', 'booking_form_url')
