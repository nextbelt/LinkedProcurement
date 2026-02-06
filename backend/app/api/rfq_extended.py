from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, RFQ, RFQResponse as RFQResponseModel, Company, POC
from app.models.rfq_extended import RFQLineItem, QuoteLineItem, RFQInvitation, RFQAward
from app.schemas.rfq_extended import (
    RFQLineItemCreate,
    RFQLineItemUpdate,
    RFQLineItemResponse,
    QuoteLineItemCreate,
    QuoteLineItemResponse,
    RFQInvitationCreate,
    RFQInvitationResponse,
    RFQAwardCreate,
    RFQAwardResponse,
    QuoteComparisonResponse,
    LineItemComparison,
    SupplierQuote,
    RFQStateTransition,
)

router = APIRouter(tags=["rfq-extended"])
security = HTTPBearer()

# Valid RFQ state transitions
VALID_TRANSITIONS = {
    "draft": ["published"],
    "published": ["evaluation"],
    "evaluation": ["closed", "awarded"],
    "closed": ["awarded"],
}


def _get_rfq_or_404(db: Session, rfq_id: uuid.UUID) -> RFQ:
    rfq = db.query(RFQ).filter(RFQ.id == rfq_id).first()
    if not rfq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFQ not found")
    return rfq


def _require_rfq_owner(user: User, rfq: RFQ):
    if rfq.buyer_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the RFQ owner can perform this action")


# ==========================================================================
# Line Items
# ==========================================================================

@router.post("/rfqs/{rfq_id}/line-items", response_model=RFQLineItemResponse, status_code=status.HTTP_201_CREATED)
async def add_line_item(
    rfq_id: uuid.UUID,
    item_data: RFQLineItemCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Add a line item to an RFQ."""
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    rfq = _get_rfq_or_404(db, rfq_id)
    _require_rfq_owner(user, rfq)

    item = RFQLineItem(
        rfq_id=rfq.id,
        line_number=item_data.line_number,
        description=item_data.description,
        part_number=item_data.part_number,
        quantity=item_data.quantity,
        unit_of_measure=item_data.unit_of_measure,
        target_unit_price=item_data.target_unit_price,
        currency=item_data.currency,
        specifications=item_data.specifications,
        required_certifications=item_data.required_certifications,
        custom_fields=item_data.custom_fields,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return RFQLineItemResponse.model_validate(item)


@router.get("/rfqs/{rfq_id}/line-items", response_model=List[RFQLineItemResponse])
async def list_line_items(
    rfq_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """List all line items for an RFQ."""
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    _get_rfq_or_404(db, rfq_id)

    items = (
        db.query(RFQLineItem)
        .filter(RFQLineItem.rfq_id == rfq_id)
        .order_by(RFQLineItem.line_number)
        .all()
    )
    return [RFQLineItemResponse.model_validate(i) for i in items]


@router.put("/rfqs/{rfq_id}/line-items/{item_id}", response_model=RFQLineItemResponse)
async def update_line_item(
    rfq_id: uuid.UUID,
    item_id: uuid.UUID,
    item_data: RFQLineItemUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Update a line item."""
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    rfq = _get_rfq_or_404(db, rfq_id)
    _require_rfq_owner(user, rfq)

    item = db.query(RFQLineItem).filter(RFQLineItem.id == item_id, RFQLineItem.rfq_id == rfq_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Line item not found")

    update_fields = item_data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return RFQLineItemResponse.model_validate(item)


@router.delete("/rfqs/{rfq_id}/line-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_line_item(
    rfq_id: uuid.UUID,
    item_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Delete a line item."""
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    rfq = _get_rfq_or_404(db, rfq_id)
    _require_rfq_owner(user, rfq)

    item = db.query(RFQLineItem).filter(RFQLineItem.id == item_id, RFQLineItem.rfq_id == rfq_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Line item not found")

    db.delete(item)
    db.commit()


# ==========================================================================
# Invitations
# ==========================================================================

@router.post("/rfqs/{rfq_id}/invite", response_model=RFQInvitationResponse, status_code=status.HTTP_201_CREATED)
async def invite_supplier(
    rfq_id: uuid.UUID,
    invite_data: RFQInvitationCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Invite a supplier company to respond to an RFQ."""
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    rfq = _get_rfq_or_404(db, rfq_id)
    _require_rfq_owner(user, rfq)

    # Verify supplier company exists
    supplier = db.query(Company).filter(Company.id == invite_data.supplier_company_id).first()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier company not found")

    # Check for duplicate invitation
    existing = (
        db.query(RFQInvitation)
        .filter(RFQInvitation.rfq_id == rfq_id, RFQInvitation.supplier_company_id == invite_data.supplier_company_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Supplier already invited to this RFQ")

    invitation = RFQInvitation(
        rfq_id=rfq.id,
        supplier_company_id=invite_data.supplier_company_id,
        invited_by=user.id,
        message=invite_data.message,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    # Create notification for supplier POCs
    try:
        from app.services.notification_service import notify_rfq_invitation
        notify_rfq_invitation(db, invitation)
    except Exception:
        pass  # Non-critical

    return RFQInvitationResponse.model_validate(invitation)


@router.get("/rfqs/{rfq_id}/invitations", response_model=List[RFQInvitationResponse])
async def list_invitations(
    rfq_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """List invitations for an RFQ."""
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    _get_rfq_or_404(db, rfq_id)

    invitations = db.query(RFQInvitation).filter(RFQInvitation.rfq_id == rfq_id).all()
    return [RFQInvitationResponse.model_validate(inv) for inv in invitations]


# ==========================================================================
# Awards
# ==========================================================================

@router.post("/rfqs/{rfq_id}/award", response_model=RFQAwardResponse, status_code=status.HTTP_201_CREATED)
async def award_rfq(
    rfq_id: uuid.UUID,
    award_data: RFQAwardCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Award an RFQ to a specific response."""
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    rfq = _get_rfq_or_404(db, rfq_id)
    _require_rfq_owner(user, rfq)

    # Verify the response belongs to this RFQ
    response = (
        db.query(RFQResponseModel)
        .filter(RFQResponseModel.id == award_data.response_id, RFQResponseModel.rfq_id == rfq_id)
        .first()
    )
    if not response:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Response not found for this RFQ")

    award = RFQAward(
        rfq_id=rfq.id,
        response_id=award_data.response_id,
        awarded_by=user.id,
        po_number=award_data.po_number,
        award_notes=award_data.award_notes,
        total_value=award_data.total_value,
        currency=award_data.currency,
    )
    db.add(award)
    db.commit()
    db.refresh(award)

    # Create notification for winning supplier
    try:
        from app.services.notification_service import notify_rfq_awarded
        notify_rfq_awarded(db, award)
    except Exception:
        pass  # Non-critical

    return RFQAwardResponse.model_validate(award)


@router.get("/rfqs/{rfq_id}/awards", response_model=List[RFQAwardResponse])
async def list_awards(
    rfq_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """List awards for an RFQ."""
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    _get_rfq_or_404(db, rfq_id)

    awards = db.query(RFQAward).filter(RFQAward.rfq_id == rfq_id).all()
    return [RFQAwardResponse.model_validate(a) for a in awards]


# ==========================================================================
# Quote Line Items (per response)
# ==========================================================================

@router.post("/responses/{response_id}/quote-items", response_model=List[QuoteLineItemResponse], status_code=status.HTTP_201_CREATED)
async def submit_quote_items(
    response_id: uuid.UUID,
    items: List[QuoteLineItemCreate],
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Submit quote line items for an RFQ response."""
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    response = db.query(RFQResponseModel).filter(RFQResponseModel.id == response_id).first()
    if not response:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFQ response not found")

    # Verify the current user is the responding POC's user
    poc = db.query(POC).filter(POC.id == response.responding_poc_id).first()
    if not poc or poc.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the responding supplier can submit quote items")

    created = []
    for item_data in items:
        # Verify line item belongs to the same RFQ
        line_item = (
            db.query(RFQLineItem)
            .filter(RFQLineItem.id == item_data.line_item_id, RFQLineItem.rfq_id == response.rfq_id)
            .first()
        )
        if not line_item:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Line item {item_data.line_item_id} not found in this RFQ",
            )

        quote_item = QuoteLineItem(
            response_id=response_id,
            line_item_id=item_data.line_item_id,
            unit_price=item_data.unit_price,
            total_price=item_data.total_price,
            currency=item_data.currency,
            lead_time_days=item_data.lead_time_days,
            moq=item_data.moq,
            notes=item_data.notes,
            is_compliant=item_data.is_compliant,
            exceptions=item_data.exceptions,
        )
        db.add(quote_item)
        created.append(quote_item)

    db.commit()
    for q in created:
        db.refresh(q)

    return [QuoteLineItemResponse.model_validate(q) for q in created]


@router.get("/responses/{response_id}/quote-items", response_model=List[QuoteLineItemResponse])
async def get_quote_items(
    response_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Get quote line items for an RFQ response."""
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    response = db.query(RFQResponseModel).filter(RFQResponseModel.id == response_id).first()
    if not response:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFQ response not found")

    items = db.query(QuoteLineItem).filter(QuoteLineItem.response_id == response_id).all()
    return [QuoteLineItemResponse.model_validate(q) for q in items]


# ==========================================================================
# Quote Comparison
# ==========================================================================

@router.get("/rfqs/{rfq_id}/compare", response_model=QuoteComparisonResponse)
async def compare_quotes(
    rfq_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    Get a normalized quote comparison across all responses and their line items.
    Only the RFQ owner can view comparisons.
    """
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    rfq = _get_rfq_or_404(db, rfq_id)
    _require_rfq_owner(user, rfq)

    line_items = (
        db.query(RFQLineItem)
        .filter(RFQLineItem.rfq_id == rfq_id)
        .order_by(RFQLineItem.line_number)
        .all()
    )

    responses = db.query(RFQResponseModel).filter(RFQResponseModel.rfq_id == rfq_id).all()

    comparisons: List[LineItemComparison] = []
    for li in line_items:
        quotes: List[SupplierQuote] = []
        for resp in responses:
            quote = (
                db.query(QuoteLineItem)
                .filter(QuoteLineItem.response_id == resp.id, QuoteLineItem.line_item_id == li.id)
                .first()
            )
            if quote:
                supplier = db.query(Company).filter(Company.id == resp.supplier_company_id).first()
                quotes.append(
                    SupplierQuote(
                        response_id=resp.id,
                        supplier_company_id=resp.supplier_company_id,
                        supplier_company_name=supplier.name if supplier else None,
                        unit_price=quote.unit_price,
                        total_price=quote.total_price,
                        currency=quote.currency,
                        lead_time_days=quote.lead_time_days,
                        moq=quote.moq,
                        is_compliant=quote.is_compliant,
                        notes=quote.notes,
                    )
                )
        comparisons.append(
            LineItemComparison(
                line_item=RFQLineItemResponse.model_validate(li),
                quotes=quotes,
            )
        )

    return QuoteComparisonResponse(rfq_id=rfq.id, line_items=comparisons)


# ==========================================================================
# RFQ State Machine Transition
# ==========================================================================

@router.post("/rfqs/{rfq_id}/transition", response_model=dict)
async def transition_rfq_state(
    rfq_id: uuid.UUID,
    transition: RFQStateTransition,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    Transition an RFQ through valid states.

    Valid transitions:
    - draft → published
    - published → evaluation
    - evaluation → closed
    - evaluation → awarded
    - closed → awarded
    """
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    rfq = _get_rfq_or_404(db, rfq_id)
    _require_rfq_owner(user, rfq)

    current_status = rfq.status
    new_status = transition.new_status

    allowed = VALID_TRANSITIONS.get(current_status, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid transition from '{current_status}' to '{new_status}'. Allowed: {allowed}",
        )

    rfq.status = new_status
    db.commit()
    db.refresh(rfq)

    return {
        "rfq_id": str(rfq.id),
        "previous_status": current_status,
        "new_status": rfq.status,
        "reason": transition.reason,
    }
