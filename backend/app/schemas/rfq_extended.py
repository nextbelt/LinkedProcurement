from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime
from decimal import Decimal
import uuid


# ---------- RFQ Line Items ----------

class RFQLineItemCreate(BaseModel):
    line_number: int
    description: str
    part_number: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit_of_measure: Optional[str] = None
    target_unit_price: Optional[Decimal] = None
    currency: str = "USD"
    specifications: Optional[str] = None
    required_certifications: List[str] = []
    custom_fields: Dict[str, Any] = {}


class RFQLineItemUpdate(BaseModel):
    line_number: Optional[int] = None
    description: Optional[str] = None
    part_number: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit_of_measure: Optional[str] = None
    target_unit_price: Optional[Decimal] = None
    currency: Optional[str] = None
    specifications: Optional[str] = None
    required_certifications: Optional[List[str]] = None
    custom_fields: Optional[Dict[str, Any]] = None


class RFQLineItemResponse(BaseModel):
    id: uuid.UUID
    rfq_id: uuid.UUID
    line_number: int
    description: str
    part_number: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit_of_measure: Optional[str] = None
    target_unit_price: Optional[Decimal] = None
    currency: str
    specifications: Optional[str] = None
    required_certifications: List[str] = []
    custom_fields: Dict[str, Any] = {}
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Quote Line Items ----------

class QuoteLineItemCreate(BaseModel):
    line_item_id: uuid.UUID
    unit_price: Optional[Decimal] = None
    total_price: Optional[Decimal] = None
    currency: str = "USD"
    lead_time_days: Optional[int] = None
    moq: Optional[Decimal] = None
    notes: Optional[str] = None
    is_compliant: bool = True
    exceptions: List[str] = []


class QuoteLineItemResponse(BaseModel):
    id: uuid.UUID
    response_id: uuid.UUID
    line_item_id: uuid.UUID
    unit_price: Optional[Decimal] = None
    total_price: Optional[Decimal] = None
    currency: str
    lead_time_days: Optional[int] = None
    moq: Optional[Decimal] = None
    notes: Optional[str] = None
    is_compliant: bool
    exceptions: List[str] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- RFQ Invitations ----------

class RFQInvitationCreate(BaseModel):
    supplier_company_id: uuid.UUID
    message: Optional[str] = None


class RFQInvitationResponse(BaseModel):
    id: uuid.UUID
    rfq_id: uuid.UUID
    supplier_company_id: uuid.UUID
    invited_by: Optional[uuid.UUID] = None
    status: str
    message: Optional[str] = None
    invited_at: datetime
    viewed_at: Optional[datetime] = None
    responded_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------- RFQ Awards ----------

class RFQAwardCreate(BaseModel):
    response_id: uuid.UUID
    po_number: Optional[str] = None
    award_notes: Optional[str] = None
    total_value: Optional[Decimal] = None
    currency: str = "USD"


class RFQAwardResponse(BaseModel):
    id: uuid.UUID
    rfq_id: uuid.UUID
    response_id: uuid.UUID
    awarded_by: Optional[uuid.UUID] = None
    awarded_at: datetime
    po_number: Optional[str] = None
    award_notes: Optional[str] = None
    total_value: Optional[Decimal] = None
    currency: str
    status: str
    accepted_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Notifications ----------

class NotificationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    type: str
    title: str
    body: Optional[str] = None
    data: Dict[str, Any] = {}
    is_read: bool
    read_at: Optional[datetime] = None
    action_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Quote Comparison ----------

class SupplierQuote(BaseModel):
    response_id: uuid.UUID
    supplier_company_id: uuid.UUID
    supplier_company_name: Optional[str] = None
    unit_price: Optional[Decimal] = None
    total_price: Optional[Decimal] = None
    currency: str = "USD"
    lead_time_days: Optional[int] = None
    moq: Optional[Decimal] = None
    is_compliant: bool = True
    notes: Optional[str] = None


class LineItemComparison(BaseModel):
    line_item: RFQLineItemResponse
    quotes: List[SupplierQuote] = []


class QuoteComparisonResponse(BaseModel):
    rfq_id: uuid.UUID
    line_items: List[LineItemComparison] = []


# ---------- RFQ State Transition ----------

class RFQStateTransition(BaseModel):
    new_status: str
    reason: Optional[str] = None
