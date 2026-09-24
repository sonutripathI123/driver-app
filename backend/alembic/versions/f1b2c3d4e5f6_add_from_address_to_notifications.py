"""add from_address and mailbox_id to notifications

Lets the Email hub show each website's outbound mail separately: a per-site
reply carries the mailbox's own address, while system emails leave these null.

Revision ID: f1b2c3d4e5f6
Revises: e4a1b9c25f30
Create Date: 2026-09-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'f1b2c3d4e5f6'
down_revision: Union[str, None] = 'e4a1b9c25f30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('notifications', sa.Column('from_address', sa.String(length=320), nullable=True))
    op.add_column('notifications', sa.Column('mailbox_id', sa.String(length=36), nullable=True))
    op.create_index('ix_notifications_from_address', 'notifications', ['from_address'])
    op.create_index('ix_notifications_mailbox_id', 'notifications', ['mailbox_id'])


def downgrade() -> None:
    op.drop_index('ix_notifications_mailbox_id', table_name='notifications')
    op.drop_index('ix_notifications_from_address', table_name='notifications')
    op.drop_column('notifications', 'mailbox_id')
    op.drop_column('notifications', 'from_address')
