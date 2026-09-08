"""create inbound_emails

Revision ID: b3f19d84c210
Revises: a1c4e9f27b03
Create Date: 2026-09-08

Stores replies delivered by the email provider's inbound webhook. Before
this, the Email Hub's inbox was four fabricated threads living in browser
storage.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'b3f19d84c210'
down_revision: Union[str, None] = 'a1c4e9f27b03'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'inbound_emails',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('provider_message_id', sa.String(length=512), nullable=True),
        sa.Column('provider', sa.String(length=50), nullable=False, server_default='unknown'),
        sa.Column('sender_email', sa.String(length=320), nullable=False),
        sa.Column('sender_name', sa.String(length=255), nullable=True),
        sa.Column('recipient_email', sa.String(length=320), nullable=True),
        sa.Column('subject', sa.String(length=998), nullable=True),
        sa.Column('body_text', sa.Text(), nullable=True),
        sa.Column('body_html', sa.Text(), nullable=True),
        sa.Column('booking_id', sa.String(length=36), nullable=True),
        sa.Column('booking_number', sa.String(length=50), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='UNREAD'),
        sa.Column('received_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inbound_emails_id', 'inbound_emails', ['id'])
    op.create_index('ix_inbound_emails_provider_message_id', 'inbound_emails', ['provider_message_id'])
    op.create_index('ix_inbound_emails_sender_email', 'inbound_emails', ['sender_email'])
    op.create_index('ix_inbound_emails_booking_id', 'inbound_emails', ['booking_id'])
    op.create_index('ix_inbound_emails_status', 'inbound_emails', ['status'])
    op.create_index('ix_inbound_emails_received_at', 'inbound_emails', ['received_at'])
    op.create_index('ix_inbound_emails_status_received', 'inbound_emails', ['status', 'received_at'])


def downgrade() -> None:
    op.drop_index('ix_inbound_emails_status_received', table_name='inbound_emails')
    op.drop_index('ix_inbound_emails_received_at', table_name='inbound_emails')
    op.drop_index('ix_inbound_emails_status', table_name='inbound_emails')
    op.drop_index('ix_inbound_emails_booking_id', table_name='inbound_emails')
    op.drop_index('ix_inbound_emails_sender_email', table_name='inbound_emails')
    op.drop_index('ix_inbound_emails_provider_message_id', table_name='inbound_emails')
    op.drop_index('ix_inbound_emails_id', table_name='inbound_emails')
    op.drop_table('inbound_emails')
