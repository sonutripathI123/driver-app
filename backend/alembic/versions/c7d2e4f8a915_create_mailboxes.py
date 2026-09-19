"""create mailboxes and tag inbound_emails by mailbox

Revision ID: c7d2e4f8a915
Revises: b3f19d84c210
Create Date: 2026-09-19

Adds the mailboxes the operator connects for the email-to-booking workflow,
and a mailbox_id on inbound_emails so each received message knows which
account it arrived on.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'c7d2e4f8a915'
down_revision: Union[str, None] = 'b3f19d84c210'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'mailboxes',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('label', sa.String(length=120), nullable=False),
        sa.Column('email_address', sa.String(length=320), nullable=False),
        sa.Column('imap_host', sa.String(length=255), nullable=False),
        sa.Column('imap_port', sa.Integer(), nullable=False, server_default='993'),
        sa.Column('smtp_host', sa.String(length=255), nullable=False),
        sa.Column('smtp_port', sa.Integer(), nullable=False, server_default='587'),
        sa.Column('smtp_use_tls', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('username', sa.String(length=320), nullable=False),
        sa.Column('encrypted_password', sa.String(length=1024), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('last_uid', sa.Integer(), nullable=True),
        sa.Column('last_polled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_poll_error', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_mailboxes_id', 'mailboxes', ['id'])
    op.create_index('ix_mailboxes_email_address', 'mailboxes', ['email_address'])

    op.add_column('inbound_emails', sa.Column('mailbox_id', sa.String(length=36), nullable=True))
    op.create_index('ix_inbound_emails_mailbox_id', 'inbound_emails', ['mailbox_id'])


def downgrade() -> None:
    op.drop_index('ix_inbound_emails_mailbox_id', table_name='inbound_emails')
    op.drop_column('inbound_emails', 'mailbox_id')
    op.drop_index('ix_mailboxes_email_address', table_name='mailboxes')
    op.drop_index('ix_mailboxes_id', table_name='mailboxes')
    op.drop_table('mailboxes')
