"""create enquiries table

Website form submissions are price enquiries, not bookings, so they live in their
own table and never reach the Operate Board.

Revision ID: a2b3c4d5e6f7
Revises: f1b2c3d4e5f6
Create Date: 2026-09-25
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, None] = 'f1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'enquiries',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('website', sa.String(length=120), nullable=True),
        sa.Column('dedup_key', sa.String(length=120), nullable=True),
        sa.Column('service_type', sa.String(length=120), nullable=True),
        sa.Column('customer_name', sa.String(length=255), nullable=False),
        sa.Column('customer_email', sa.String(length=320), nullable=True),
        sa.Column('customer_phone', sa.String(length=50), nullable=True),
        sa.Column('pickup_address', sa.String(length=500), nullable=True),
        sa.Column('dropoff_address', sa.String(length=500), nullable=True),
        sa.Column('pickup_datetime', sa.DateTime(timezone=True), nullable=True),
        sa.Column('vehicle_category', sa.String(length=60), nullable=True),
        sa.Column('passenger_count', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('luggage_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_airport_pickup', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('flight_number', sa.String(length=20), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='NEW'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_enquiries_website', 'enquiries', ['website'])
    op.create_index('ix_enquiries_dedup_key', 'enquiries', ['dedup_key'])
    op.create_index('ix_enquiries_customer_email', 'enquiries', ['customer_email'])
    op.create_index('ix_enquiries_status', 'enquiries', ['status'])
    op.create_index('ix_enquiries_created_at', 'enquiries', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_enquiries_created_at', table_name='enquiries')
    op.drop_index('ix_enquiries_status', table_name='enquiries')
    op.drop_index('ix_enquiries_customer_email', table_name='enquiries')
    op.drop_index('ix_enquiries_dedup_key', table_name='enquiries')
    op.drop_index('ix_enquiries_website', table_name='enquiries')
    op.drop_table('enquiries')
