"""Add notifications and categories

Revision ID: 006
Revises: 005
Create Date: 2026-02-05

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade():
    # Notifications table
    op.create_table(
        'notifications',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),  # rfq_response, rfq_awarded, message, system, rfq_expiring, invitation
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('data', JSONB, server_default='{}'),
        sa.Column('is_read', sa.Boolean(), server_default='false'),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('action_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('ix_notifications_is_read', 'notifications', ['is_read'])
    op.create_index('ix_notifications_created_at', 'notifications', ['created_at'])

    # Categories / taxonomy table
    op.create_table(
        'categories',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('parent_id', UUID(as_uuid=True), sa.ForeignKey('categories.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(255), nullable=False),
        sa.Column('code', sa.String(50), nullable=True),  # UNSPSC code (optional)
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('level', sa.Integer(), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('metadata', JSONB, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_categories_parent_id', 'categories', ['parent_id'])
    op.create_index('ix_categories_slug', 'categories', ['slug'])
    op.create_index('ix_categories_code', 'categories', ['code'])

    # Supplier capabilities (structured graph)
    op.create_table(
        'supplier_capabilities',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('company_id', UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category_id', UUID(as_uuid=True), sa.ForeignKey('categories.id', ondelete='CASCADE'), nullable=True),
        sa.Column('capability_name', sa.String(255), nullable=False),
        sa.Column('certifications', JSONB, server_default='[]'),
        sa.Column('regions_served', JSONB, server_default='[]'),
        sa.Column('capacity', JSONB, server_default='{}'),  # {min_order, max_order, lead_time_range}
        sa.Column('experience_years', sa.Integer(), nullable=True),
        sa.Column('is_verified', sa.Boolean(), server_default='false'),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_supplier_capabilities_company_id', 'supplier_capabilities', ['company_id'])
    op.create_index('ix_supplier_capabilities_category_id', 'supplier_capabilities', ['category_id'])

    # Custom fields (per-org extensible schema)
    op.create_table(
        'custom_fields',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('organization_id', UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),  # rfq, quote, company
        sa.Column('field_name', sa.String(100), nullable=False),
        sa.Column('field_label', sa.String(255), nullable=False),
        sa.Column('field_type', sa.String(50), nullable=False),  # text, number, date, select, multiselect, boolean
        sa.Column('is_required', sa.Boolean(), server_default='false'),
        sa.Column('validation', JSONB, server_default='{}'),  # {min, max, options, pattern}
        sa.Column('display_order', sa.Integer(), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('organization_id', 'entity_type', 'field_name', name='uq_custom_fields_org_entity_name'),
    )
    op.create_index('ix_custom_fields_org_id', 'custom_fields', ['organization_id'])


def downgrade():
    op.drop_table('custom_fields')
    op.drop_table('supplier_capabilities')
    op.drop_table('categories')
    op.drop_table('notifications')
