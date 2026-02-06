"""Add line items, invitations, and awards

Revision ID: 005
Revises: 004
Create Date: 2026-02-05

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade():
    # RFQ Line Items
    op.create_table(
        'rfq_line_items',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('rfq_id', UUID(as_uuid=True), sa.ForeignKey('rfqs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('line_number', sa.Integer(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('part_number', sa.String(100), nullable=True),
        sa.Column('quantity', sa.Numeric(12, 2), nullable=True),
        sa.Column('unit_of_measure', sa.String(50), nullable=True),
        sa.Column('target_unit_price', sa.Numeric(12, 4), nullable=True),
        sa.Column('currency', sa.String(10), server_default='USD'),
        sa.Column('specifications', sa.Text(), nullable=True),
        sa.Column('required_certifications', JSONB, server_default='[]'),
        sa.Column('attachments', JSONB, server_default='[]'),
        sa.Column('custom_fields', JSONB, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_rfq_line_items_rfq_id', 'rfq_line_items', ['rfq_id'])

    # Quote Line Items (supplier responses per line item)
    op.create_table(
        'quote_line_items',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('response_id', UUID(as_uuid=True), sa.ForeignKey('rfq_responses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('line_item_id', UUID(as_uuid=True), sa.ForeignKey('rfq_line_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('unit_price', sa.Numeric(12, 4), nullable=True),
        sa.Column('total_price', sa.Numeric(14, 2), nullable=True),
        sa.Column('currency', sa.String(10), server_default='USD'),
        sa.Column('lead_time_days', sa.Integer(), nullable=True),
        sa.Column('moq', sa.Numeric(12, 2), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_compliant', sa.Boolean(), server_default='true'),
        sa.Column('exceptions', JSONB, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_quote_line_items_response_id', 'quote_line_items', ['response_id'])
    op.create_index('ix_quote_line_items_line_item_id', 'quote_line_items', ['line_item_id'])

    # RFQ Invitations
    op.create_table(
        'rfq_invitations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('rfq_id', UUID(as_uuid=True), sa.ForeignKey('rfqs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_company_id', UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('invited_by', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('status', sa.String(50), server_default='pending'),  # pending, viewed, responded, declined
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('invited_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('viewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('rfq_id', 'supplier_company_id', name='uq_rfq_invitations_rfq_supplier'),
    )
    op.create_index('ix_rfq_invitations_rfq_id', 'rfq_invitations', ['rfq_id'])
    op.create_index('ix_rfq_invitations_supplier_company_id', 'rfq_invitations', ['supplier_company_id'])

    # RFQ Awards
    op.create_table(
        'rfq_awards',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('rfq_id', UUID(as_uuid=True), sa.ForeignKey('rfqs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('response_id', UUID(as_uuid=True), sa.ForeignKey('rfq_responses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('awarded_by', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('awarded_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('po_number', sa.String(100), nullable=True),
        sa.Column('award_notes', sa.Text(), nullable=True),
        sa.Column('total_value', sa.Numeric(14, 2), nullable=True),
        sa.Column('currency', sa.String(10), server_default='USD'),
        sa.Column('status', sa.String(50), server_default='awarded'),  # awarded, accepted, declined, cancelled
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_rfq_awards_rfq_id', 'rfq_awards', ['rfq_id'])
    op.create_index('ix_rfq_awards_response_id', 'rfq_awards', ['response_id'])

    # Add 'draft' to RFQ status options and add organization_id
    op.add_column('rfqs', sa.Column('organization_id', UUID(as_uuid=True), nullable=True))
    
    # Add enhanced RFQ fields
    op.add_column('rfqs', sa.Column('is_sealed_bid', sa.Boolean(), server_default='false'))
    op.add_column('rfqs', sa.Column('requires_nda', sa.Boolean(), server_default='false'))
    
    # Add organization_id to companies
    op.add_column('companies', sa.Column('organization_id', UUID(as_uuid=True), nullable=True))


def downgrade():
    op.drop_column('companies', 'organization_id')
    op.drop_column('rfqs', 'requires_nda')
    op.drop_column('rfqs', 'is_sealed_bid')
    op.drop_column('rfqs', 'organization_id')
    op.drop_table('rfq_awards')
    op.drop_table('rfq_invitations')
    op.drop_table('quote_line_items')
    op.drop_table('rfq_line_items')
