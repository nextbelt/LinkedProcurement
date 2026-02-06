"""Add organizations, roles, and RBAC

Revision ID: 004
Revises: 003
Create Date: 2026-02-05

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    # Organizations table
    op.create_table(
        'organizations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(255), nullable=False, unique=True),
        sa.Column('owner_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('logo_url', sa.Text(), nullable=True),
        sa.Column('plan_tier', sa.String(50), server_default='free'),
        sa.Column('settings', JSONB, server_default='{}'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_organizations_slug', 'organizations', ['slug'], unique=True)
    op.create_index('ix_organizations_owner_id', 'organizations', ['owner_id'])

    # Roles table
    op.create_table(
        'roles',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(100), nullable=False, unique=True),
        sa.Column('display_name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('permissions', JSONB, server_default='[]'),
        sa.Column('is_system', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    # Org members (user <-> org with role)
    op.create_table(
        'org_members',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('organization_id', UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role_id', UUID(as_uuid=True), sa.ForeignKey('roles.id', ondelete='SET NULL'), nullable=True),
        sa.Column('invited_by', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.UniqueConstraint('organization_id', 'user_id', name='uq_org_members_org_user'),
    )
    op.create_index('ix_org_members_organization_id', 'org_members', ['organization_id'])
    op.create_index('ix_org_members_user_id', 'org_members', ['user_id'])

    # Seed default roles
    op.execute("""
        INSERT INTO roles (id, name, display_name, description, permissions, is_system) VALUES
        (gen_random_uuid(), 'org_admin', 'Organization Admin', 'Full access to organization settings and members', '["org.manage", "org.members", "rfq.create", "rfq.edit", "rfq.delete", "rfq.award", "quote.view", "quote.compare", "messages.send", "billing.manage"]'::jsonb, true),
        (gen_random_uuid(), 'buyer', 'Buyer', 'Can create RFPs, compare quotes, and award contracts', '["rfq.create", "rfq.edit", "rfq.delete", "rfq.award", "quote.view", "quote.compare", "messages.send"]'::jsonb, true),
        (gen_random_uuid(), 'supplier', 'Supplier', 'Can browse RFPs, submit quotes, and respond to inquiries', '["rfq.browse", "quote.submit", "quote.edit", "messages.send"]'::jsonb, true),
        (gen_random_uuid(), 'viewer', 'Viewer', 'Read-only access to organization data', '["rfq.browse", "quote.view"]'::jsonb, true);
    """)


def downgrade():
    op.drop_table('org_members')
    op.drop_table('roles')
    op.drop_table('organizations')
