from sqlalchemy import Column, String, DateTime, Boolean, Text, Integer, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)  # Can be null for LinkedIn-only users
    name = Column(String(255), nullable=False)
    profile_picture_url = Column(Text, nullable=True)
    
    # LinkedIn specific fields
    linkedin_id = Column(String(255), unique=True, nullable=True, index=True)
    linkedin_profile_url = Column(Text, nullable=True)
    last_linkedin_verification = Column(DateTime, nullable=True)
    
    # Account status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    verification_status = Column(String(50), default="pending")  # pending, verified, rejected
    deletion_scheduled_at = Column(DateTime, nullable=True)  # GDPR/CCPA compliance
    
    # Account security (SOC 2 Compliance)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    last_login_ip = Column(String(45), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    company_associations = relationship("POC", back_populates="user")
    sent_rfqs = relationship("RFQ", back_populates="buyer", foreign_keys="RFQ.buyer_id")
    sent_messages = relationship("Message", back_populates="sender", foreign_keys="Message.sender_id")
    received_messages = relationship("Message", back_populates="recipient", foreign_keys="Message.recipient_id")
    subscription = relationship("Subscription", back_populates="user", uselist=False)


class Company(Base):
    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), nullable=False, index=True)
    domain = Column(String(255), nullable=True, index=True)
    
    # LinkedIn specific
    linkedin_company_id = Column(String(255), nullable=True, unique=True)
    
    # Company details
    industry = Column(String(255), nullable=True)
    headquarters_location = Column(String(255), nullable=True)
    employee_count = Column(String(50), nullable=True)  # e.g., "51-200", "1001-5000"
    founded_year = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    logo_url = Column(Text, nullable=True)
    website_url = Column(Text, nullable=True)
    
    # Company type and business focus
    company_type = Column(String(100), nullable=True)  # manufacturer, distributor, service_provider, both
    business_categories = Column(Text, nullable=True)  # JSON array of categories supplier focuses on
    raw_materials_focus = Column(Text, nullable=True)  # JSON array of raw materials company works with
    
    # Tenant isolation
    organization_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Business verification
    duns_number = Column(String(50), nullable=True)
    is_verified = Column(Boolean, default=False)
    verification_source = Column(String(100), nullable=True)  # linkedin, duns, manual
    
    # Capabilities and certifications (stored as JSONB)
    certifications = Column(JSONB, nullable=True, default=list)
    capabilities = Column(JSONB, nullable=True, default=list)
    materials = Column(JSONB, nullable=True, default=list)
    naics_codes = Column(JSONB, nullable=True, default=list)
    
    # Performance metrics
    response_rate = Column(Integer, default=0)  # Percentage
    avg_response_time_hours = Column(Integer, nullable=True)
    total_rfqs_received = Column(Integer, default=0)
    total_rfqs_responded = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    pocs = relationship("POC", back_populates="company")
    sent_rfqs = relationship("RFQ", back_populates="buyer_company", foreign_keys="RFQ.buyer_company_id")
    received_responses = relationship("RFQResponse", back_populates="supplier_company")


class POC(Base):
    __tablename__ = "pocs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Role and status
    role = Column(String(255), nullable=True)  # e.g., "Sales Manager", "Procurement Officer"
    is_primary = Column(Boolean, default=False)
    is_on_call = Column(Boolean, default=False)
    availability_status = Column(String(50), default="available")  # available, busy, offline
    
    # Performance metrics
    avg_response_time_hours = Column(Integer, nullable=True)
    response_rate = Column(Integer, default=0)  # Percentage
    total_rfqs_handled = Column(Integer, default=0)
    
    # Timestamps
    last_active_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    company = relationship("Company", back_populates="pocs")
    user = relationship("User", back_populates="company_associations")
    responses = relationship("RFQResponse", back_populates="responding_poc")


class RFQ(Base):
    __tablename__ = "rfqs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    buyer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    buyer_company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # Tenant isolation
    
    # RFQ details
    title = Column(String(255), nullable=False)
    material_category = Column(String(255), nullable=True, index=True)
    quantity = Column(String(255), nullable=True)  # e.g., "5000 kg", "100 units"
    target_price = Column(String(255), nullable=True)
    specifications = Column(Text, nullable=True)
    delivery_deadline = Column(DateTime, nullable=True)
    delivery_location = Column(String(500), nullable=True)
    
    # Enhanced RFQ fields (Buyer requirements)
    part_number = Column(String(100), nullable=True, index=True)
    part_number_description = Column(Text, nullable=True)
    delivery_plant = Column(String(255), nullable=True)
    yearly_quantity = Column(String(100), nullable=True)
    moq_required = Column(String(100), nullable=True)
    price_unit = Column(String(50), nullable=True)  # e.g., "per piece", "per kg"
    unit_of_measure = Column(String(50), nullable=True)  # e.g., "kg", "units", "meters"
    currency = Column(String(10), nullable=True)  # e.g., "USD", "EUR", "GBP"
    incoterm = Column(String(20), nullable=True)  # e.g., "FOB", "CIF", "EXW", "DDP"
    commodity = Column(String(255), nullable=True, index=True)
    
    # Requirements (stored as JSONB)
    required_certifications = Column(JSONB, nullable=True, default=list)
    preferred_suppliers = Column(JSONB, nullable=True, default=list)
    attachments = Column(JSONB, nullable=True, default=list)
    
    # Procurement controls
    is_sealed_bid = Column(Boolean, default=False)
    requires_nda = Column(Boolean, default=False)
    
    # Status and lifecycle
    status = Column(String(50), default="draft", index=True)  # draft, published, evaluation, closed, awarded
    visibility = Column(String(50), default="public")  # public, private, invited_only
    expires_at = Column(DateTime, nullable=True)
    
    # Metrics
    view_count = Column(Integer, default=0)
    response_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    buyer = relationship("User", back_populates="sent_rfqs")
    buyer_company = relationship("Company", back_populates="sent_rfqs")
    responses = relationship("RFQResponse", back_populates="rfq")
    messages = relationship("Message", back_populates="rfq")


class RFQResponse(Base):
    __tablename__ = "rfq_responses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    rfq_id = Column(UUID(as_uuid=True), ForeignKey("rfqs.id"), nullable=False, index=True)
    supplier_company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    responding_poc_id = Column(UUID(as_uuid=True), ForeignKey("pocs.id"), nullable=False, index=True)
    
    # Response details
    status = Column(String(50), default="submitted", index=True)  # submitted, under_review, accepted, rejected
    price_quote = Column(Numeric(14, 4), nullable=True)
    lead_time_days = Column(Integer, nullable=True)
    minimum_order_quantity = Column(String(255), nullable=True)
    message = Column(Text, nullable=True)
    
    # Enhanced Supplier Response fields
    supplier_part_number = Column(String(100), nullable=True)
    production_batch_size = Column(String(100), nullable=True)
    supplier_moq = Column(String(100), nullable=True)
    supplier_unit_of_measure = Column(String(50), nullable=True)  # e.g., "kg", "units", "meters"
    production_lead_time_days = Column(Integer, nullable=True)  # Calendar days
    raw_material_type = Column(String(255), nullable=True)
    raw_material_cost = Column(String(100), nullable=True)  # Currency/kg format
    
    # Attachments and additional info
    attachments = Column(JSONB, nullable=True, default=list)
    certifications_provided = Column(JSONB, nullable=True, default=list)
    
    # Response metrics
    is_competitive = Column(Boolean, nullable=True)
    buyer_rating = Column(Integer, nullable=True)  # 1-5 stars
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    rfq = relationship("RFQ", back_populates="responses")
    supplier_company = relationship("Company", back_populates="received_responses")
    responding_poc = relationship("POC", back_populates="responses")


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    rfq_id = Column(UUID(as_uuid=True), ForeignKey("rfqs.id"), nullable=False, index=True)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Message content
    content = Column(Text, nullable=False)
    message_type = Column(String(50), default="text")  # text, system, attachment
    attachments = Column(Text, nullable=True)  # JSON string of file URLs
    
    # Status
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    rfq = relationship("RFQ", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages", foreign_keys=[sender_id])
    recipient = relationship("User", back_populates="received_messages", foreign_keys=[recipient_id])


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    # Subscription details
    tier = Column(String(50), default="free", nullable=False, index=True)  # free, pro, premium
    status = Column(String(50), default="active", nullable=False, index=True)  # active, cancelled, past_due, paused
    billing_cycle = Column(String(50), default="monthly")  # monthly, annual
    
    # Pricing
    price_amount = Column(Numeric(10, 2), nullable=True)  # Amount in USD
    currency = Column(String(10), default="USD")
    
    # Stripe integration
    stripe_customer_id = Column(String(255), nullable=True, unique=True, index=True)
    stripe_subscription_id = Column(String(255), nullable=True, unique=True, index=True)
    stripe_payment_method_id = Column(String(255), nullable=True)
    
    # Billing dates
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    trial_start = Column(DateTime, nullable=True)
    trial_end = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    
    # Usage limits (reset monthly)
    rfq_limit = Column(Integer, nullable=True)  # null = unlimited
    rfqs_posted_this_month = Column(Integer, default=0)
    response_limit = Column(Integer, nullable=True)  # null = unlimited
    responses_sent_this_month = Column(Integer, default=0)
    
    # Features (JSON string for flexibility)
    features_enabled = Column(Text, nullable=True)  # JSON: analytics, priority_support, custom_branding, etc.
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="subscription")
    invoices = relationship("Invoice", back_populates="subscription")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id"), nullable=False, index=True)
    
    # Invoice details
    invoice_number = Column(String(100), unique=True, nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(10), default="USD")
    status = Column(String(50), default="pending", nullable=False)  # pending, paid, failed, refunded
    
    # Stripe integration
    stripe_invoice_id = Column(String(255), nullable=True, unique=True)
    stripe_payment_intent_id = Column(String(255), nullable=True)
    
    # Billing period
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    
    # Payment details
    paid_at = Column(DateTime, nullable=True)
    payment_method = Column(String(100), nullable=True)  # card, bank_transfer, etc.
    
    # Invoice files
    invoice_pdf_url = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    subscription = relationship("Subscription", back_populates="invoices")