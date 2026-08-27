"""create_partners_and_update_legs

Revision ID: f942fde6e0ea
Revises: 8fd50c566d7d
Create Date: 2026-08-27 17:11:19.661242

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f942fde6e0ea'
down_revision: Union[str, Sequence[str], None] = '8fd50c566d7d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("DROP TABLE IF EXISTS partners")
    op.create_table('partners',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('company_name', sa.String(length=255), nullable=False),
        sa.Column('contact_name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=False),
        sa.Column('abn', sa.String(length=50), nullable=True),
        sa.Column('commission_rate', sa.Float(), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('partners', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_partners_company_name'), ['company_name'], unique=False)
        batch_op.create_index(batch_op.f('ix_partners_email'), ['email'], unique=False)
        batch_op.create_index(batch_op.f('ix_partners_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_partners_phone'), ['phone'], unique=False)

    with op.batch_alter_table('booking_legs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('partner_payout_amount', sa.Float(), server_default='0.0', nullable=False))
        batch_op.add_column(sa.Column('partner_reference', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('settled_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('settlement_notes', sa.Text(), nullable=True))
        batch_op.create_foreign_key('fk_booking_legs_partner_id_partners', 'partners', ['partner_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('booking_legs', schema=None) as batch_op:
        batch_op.drop_constraint('fk_booking_legs_partner_id_partners', type_='foreignkey')
        batch_op.drop_column('settlement_notes')
        batch_op.drop_column('settled_at')
        batch_op.drop_column('partner_reference')
        batch_op.drop_column('partner_payout_amount')

    with op.batch_alter_table('partners', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_partners_phone'))
        batch_op.drop_index(batch_op.f('ix_partners_id'))
        batch_op.drop_index(batch_op.f('ix_partners_email'))
        batch_op.drop_index(batch_op.f('ix_partners_company_name'))

    op.drop_table('partners')
