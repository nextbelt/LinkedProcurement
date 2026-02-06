from sqlalchemy import Column, String, DateTime, Boolean, Text, Integer, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base


class RFQLineItem(Base):
    __tablename__ = "rfq_line_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfq_id = Column(UUID(as_uuid=True), ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False, index=True)
    line_number = Column(Integer, nullable=False)
    description = Column(Text, nullable=False)
    part_number = Column(String(100), nullable=True)
    quantity = Column(Numeric(12, 2), nullable=True)
    unit_of_measure = Column(String(50), nullable=True)
    target_unit_price = Column(Numeric(12, 4), nullable=True)
    currency = Column(String(10), default="USD")
    specifications = Column(Text, nullable=True)
    required_certifications = Column(JSONB, default=list)
    attachments = Column(JSONB, default=list)
    custom_fields = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    rfq = relationship("RFQ", backref="line_items")
    quote_items = relationship("QuoteLineItem", back_populates="line_item", cascade="all, delete-orphan")


class QuoteLineItem(Base):
    __tablename__ = "quote_line_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    response_id = Column(UUID(as_uuid=True), ForeignKey("rfq_responses.id", ondelete="CASCADE"), nullable=False, index=True)
    line_item_id = Column(UUID(as_uuid=True), ForeignKey("rfq_line_items.id", ondelete="CASCADE"), nullable=False, index=True)
    unit_price = Column(Numeric(12, 4), nullable=True)
    total_price = Column(Numeric(14, 2), nullable=True)
    currency = Column(String(10), default="USD")
    lead_time_days = Column(Integer, nullable=True)
    moq = Column(Numeric(12, 2), nullable=True)
    notes = Column(Text, nullable=True)
    is_compliant = Column(Boolean, default=True)
    exceptions = Column(JSONB, default=list)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    response = relationship("RFQResponse", backref="quote_items")
    line_item = relationship("RFQLineItem", back_populates="quote_items")


class RFQInvitation(Base):
    __tablename__ = "rfq_invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfq_id = Column(UUID(as_uuid=True), ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    invited_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(50), default="pending")  # pending, viewed, responded, declined
    message = Column(Text, nullable=True)
    invited_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    viewed_at = Column(DateTime(timezone=True), nullable=True)
    responded_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (UniqueConstraint('rfq_id', 'supplier_company_id', name='uq_rfq_invitations_rfq_supplier'),)

    # Relationships
    rfq = relationship("RFQ", backref="invitations")
    supplier_company = relationship("Company")
    inviter = relationship("User")


class RFQAward(Base):
    __tablename__ = "rfq_awards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfq_id = Column(UUID(as_uuid=True), ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False, index=True)
    response_id = Column(UUID(as_uuid=True), ForeignKey("rfq_responses.id", ondelete="CASCADE"), nullable=False, index=True)
    awarded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    awarded_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    po_number = Column(String(100), nullable=True)
    award_notes = Column(Text, nullable=True)
    total_value = Column(Numeric(14, 2), nullable=True)
    currency = Column(String(10), default="USD")
    status = Column(String(50), default="awarded")  # awarded, accepted, declined, cancelled
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    rfq = relationship("RFQ", backref="awards")
    response = relationship("RFQResponse", backref="award")
    awarder = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=True)
    data = Column(JSONB, default=dict)
    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    action_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)

    # Relationships
    user = relationship("User", backref="notifications")


class Category(Base):
    __tablename__ = "categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False, index=True)
    code = Column(String(50), nullable=True, index=True)  # UNSPSC
    description = Column(Text, nullable=True)
    level = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    metadata_json = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Self-referential relationship
    parent = relationship("Category", remote_side=[id], backref="children")


class SupplierCapability(Base):
    __tablename__ = "supplier_capabilities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="CASCADE"), nullable=True, index=True)
    capability_name = Column(String(255), nullable=False)
    certifications = Column(JSONB, default=list)
    regions_served = Column(JSONB, default=list)
    capacity = Column(JSONB, default=dict)
    experience_years = Column(Integer, nullable=True)
    is_verified = Column(Boolean, default=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company", backref="capabilities_list")
    category = relationship("Category")


class CustomField(Base):
    __tablename__ = "custom_fields"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False)
    field_name = Column(String(100), nullable=False)
    field_label = Column(String(255), nullable=False)
    field_type = Column(String(50), nullable=False)
    is_required = Column(Boolean, default=False)
    validation = Column(JSONB, default=dict)
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (UniqueConstraint('organization_id', 'entity_type', 'field_name', name='uq_custom_fields_org_entity_name'),)

    # Relationships
    organization = relationship("Organization")
