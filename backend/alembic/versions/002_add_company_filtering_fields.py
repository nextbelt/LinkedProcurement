"""Add company filtering fields

Revision ID: 002
Revises: 6f82e0cd1e23
Create Date: 2025-10-28

"""
from alembic import op
import sqlalchemy as sa

revision = '002'
down_revision = '6f82e0cd1e23'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('companies', sa.Column('company_type', sa.String(100), nullable=True))
    op.add_column('companies', sa.Column('business_categories', sa.Text(), nullable=True))
    op.add_column('companies', sa.Column('raw_materials_focus', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('companies', 'raw_materials_focus')
    op.drop_column('companies', 'business_categories')
    op.drop_column('companies', 'company_type')
