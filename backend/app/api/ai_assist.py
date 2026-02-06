"""
AI-Assist API endpoints.

Provides LLM-powered features:
- POST /api/v1/ai/generate-line-items — auto-generate structured RFQ line items from text
- POST /api/v1/ai/normalize-quotes — normalize quotes for comparison
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from decimal import Decimal

from app.core.database import get_db
from app.core.security import get_current_user
from app.services.ai_rfp_builder import ai_rfp_builder
from app.services.quote_normalization import quote_normalizer

router = APIRouter(prefix="/api/v1/ai", tags=["ai-assist"])
security = HTTPBearer()


# ---- Request / Response Schemas ----

class GenerateLineItemsRequest(BaseModel):
    buyer_intent: str = Field(..., min_length=10, max_length=5000, description="Free-text description of procurement needs")
    category_hint: Optional[str] = Field(None, description="Optional category to guide AI")
    budget_hint: Optional[str] = Field(None, description="Optional budget range")
    additional_context: Optional[str] = Field(None, description="Industry, compliance, or other context")

class GeneratedLineItem(BaseModel):
    line_number: int
    description: str
    part_number: Optional[str] = None
    quantity: Optional[float] = None
    unit_of_measure: str = "each"
    target_unit_price: Optional[float] = None
    specifications: Optional[str] = None
    required_certifications: List[str] = []
    category: Optional[str] = None

class GenerateLineItemsResponse(BaseModel):
    line_items: List[GeneratedLineItem]
    suggested_category: Optional[str] = None
    confidence: float
    warnings: List[str] = []

class QuoteInput(BaseModel):
    supplier_id: str
    supplier_name: str
    unit_price: float
    currency: str = "USD"
    unit_of_measure: str = "each"
    quantity_offered: Optional[float] = None
    moq: Optional[float] = None
    lead_time_days: Optional[int] = None
    incoterm: str = "FOB"

class NormalizeQuotesRequest(BaseModel):
    buyer_currency: str = Field("USD", description="Target currency for normalization")
    buyer_uom: str = Field("each", description="Target unit of measure")
    buyer_quantity: Optional[float] = Field(None, description="Buyer's requested quantity")
    buyer_incoterm: str = Field("FOB", description="Buyer's target incoterm")
    quotes: List[QuoteInput]

class NormalizeQuotesResponse(BaseModel):
    base_currency: str
    base_uom: str
    base_incoterm: str
    normalized_quotes: List[Dict[str, Any]]
    ranking: List[Dict[str, Any]]
    warnings: List[str] = []


# ---- Endpoints ----

@router.post("/generate-line-items", response_model=GenerateLineItemsResponse)
async def generate_line_items(
    request: GenerateLineItemsRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    AI-powered RFP line item generation.
    
    Takes free-text buyer intent and returns structured, editable line items
    with suggested quantities, specs, certifications, and pricing.
    """
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    result = await ai_rfp_builder.generate_line_items(
        buyer_intent=request.buyer_intent,
        category_hint=request.category_hint,
        budget_hint=request.budget_hint,
        additional_context=request.additional_context,
    )

    return GenerateLineItemsResponse(**result)


@router.post("/normalize-quotes", response_model=NormalizeQuotesResponse)
async def normalize_quotes(
    request: NormalizeQuotesRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    Normalize supplier quotes to a common basis for fair comparison.
    
    Converts currencies, units of measure, and incoterms to buyer's preferred
    terms, then ranks quotes by normalized unit price.
    """
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    quotes_dicts = [q.dict() for q in request.quotes]
    buyer_qty = Decimal(str(request.buyer_quantity)) if request.buyer_quantity else None

    result = quote_normalizer.normalize_quotes(
        buyer_currency=request.buyer_currency,
        buyer_uom=request.buyer_uom,
        buyer_quantity=buyer_qty,
        buyer_incoterm=request.buyer_incoterm,
        quotes=quotes_dicts,
    )

    return NormalizeQuotesResponse(**result)
