"""Fix anti-patterns: Text to JSONB, price_quote to Numeric, audit_log user_id to UUID

Revision ID: 007
Revises: 006
Create Date: 2026-02-05

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade():
    # --- 1. companies: Text → JSONB ---
    for col in ['certifications', 'capabilities', 'materials', 'naics_codes']:
        op.execute(f"""
            ALTER TABLE companies
            ALTER COLUMN {col} TYPE JSONB
            USING CASE WHEN {col} IS NOT NULL AND {col} != '' THEN {col}::jsonb ELSE '[]'::jsonb END
        """)

    # --- 2. rfqs: Text → JSONB ---
    for col in ['required_certifications', 'preferred_suppliers', 'attachments']:
        op.execute(f"""
            ALTER TABLE rfqs
            ALTER COLUMN {col} TYPE JSONB
            USING CASE WHEN {col} IS NOT NULL AND {col} != '' THEN {col}::jsonb ELSE '[]'::jsonb END
        """)

    # --- 3. rfq_responses: Text → JSONB ---
    for col in ['attachments', 'certifications_provided']:
        op.execute(f"""
            ALTER TABLE rfq_responses
            ALTER COLUMN {col} TYPE JSONB
            USING CASE WHEN {col} IS NOT NULL AND {col} != '' THEN {col}::jsonb ELSE '[]'::jsonb END
        """)

    # --- 4. rfq_responses.price_quote: String → Numeric ---
    op.execute("""
        ALTER TABLE rfq_responses
        ALTER COLUMN price_quote TYPE NUMERIC(14,4)
        USING CASE
            WHEN price_quote IS NOT NULL AND price_quote ~ '^[0-9]+(\\.[0-9]+)?$'
            THEN price_quote::numeric(14,4)
            ELSE NULL
        END
    """)

    # --- 5. audit_logs.details: Text → JSONB ---
    op.execute("""
        ALTER TABLE audit_logs
        ALTER COLUMN details TYPE JSONB
        USING CASE WHEN details IS NOT NULL AND details != '' THEN details::jsonb ELSE '{}'::jsonb END
    """)

    # --- 6. audit_logs.user_id: String → UUID (nullable) ---
    op.execute("""
        ALTER TABLE audit_logs
        ALTER COLUMN user_id TYPE UUID USING user_id::uuid
    """)
    # Note: We don't add an FK constraint here because audit_log entries may
    # outlive user rows (SOC 2 retention requirement). But the column is now UUID.


def downgrade():
    # Reverse user_id back to String
    op.execute("ALTER TABLE audit_logs ALTER COLUMN user_id TYPE VARCHAR USING user_id::varchar")
    
    # Reverse details back to Text
    op.execute("ALTER TABLE audit_logs ALTER COLUMN details TYPE TEXT USING details::text")
    
    # Reverse price_quote back to String
    op.execute("ALTER TABLE rfq_responses ALTER COLUMN price_quote TYPE VARCHAR(255) USING price_quote::varchar")
    
    # Reverse rfq_responses JSONB back to Text
    for col in ['attachments', 'certifications_provided']:
        op.execute(f"ALTER TABLE rfq_responses ALTER COLUMN {col} TYPE TEXT USING {col}::text")
    
    # Reverse rfqs JSONB back to Text
    for col in ['required_certifications', 'preferred_suppliers', 'attachments']:
        op.execute(f"ALTER TABLE rfqs ALTER COLUMN {col} TYPE TEXT USING {col}::text")
    
    # Reverse companies JSONB back to Text
    for col in ['certifications', 'capabilities', 'materials', 'naics_codes']:
        op.execute(f"ALTER TABLE companies ALTER COLUMN {col} TYPE TEXT USING {col}::text")
