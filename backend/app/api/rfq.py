from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from datetime import datetime, timedelta
import uuid

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.sanitizer import sanitize_rfq_data
from app.models.user import User, RFQ, RFQResponse, Company, POC
from app.services.audit_service import audit_service
from app.schemas.rfq import (
    RFQCreate,
    RFQUpdate, 
    RFQResponse as RFQResponseSchema,
    RFQList,
    RFQDetail,
    RFQResponseCreate,
    RFQResponseUpdate
)

router = APIRouter(prefix="/rfqs", tags=["rfq"])
security = HTTPBearer()


@router.post("", response_model=RFQResponseSchema)
async def create_rfq(
    rfq_data: RFQCreate,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """
    Create a new RFQ (Request for Quote)
    """
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get user's company (must be a POC)
    poc = db.query(POC).filter(POC.user_id == user.id).first()
    if not poc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be associated with a company to post RFQs"
        )
    
    # Set expiration date if not provided
    expires_at = rfq_data.expires_at
    if not expires_at:
        expires_at = datetime.utcnow() + timedelta(days=30)
    
    # Sanitize input data to prevent XSS
    rfq_dict = rfq_data.dict()
    sanitized_data = sanitize_rfq_data(rfq_dict)
    
    # Create RFQ
    # Resolve organization_id from user's org membership
    from app.models.organization import OrgMember
    org_member = db.query(OrgMember).filter(
        OrgMember.user_id == user.id,
        OrgMember.is_active == True
    ).first()
    
    rfq = RFQ(
        buyer_id=user.id,
        buyer_company_id=poc.company_id,
        organization_id=org_member.organization_id if org_member else None,
        title=sanitized_data.get('title', rfq_data.title),
        material_category=sanitized_data.get('material_category', rfq_data.material_category),
        quantity=rfq_data.quantity,
        target_price=rfq_data.target_price,
        specifications=sanitized_data.get('specifications', rfq_data.specifications),
        delivery_deadline=rfq_data.delivery_deadline,
        delivery_location=sanitized_data.get('delivery_location', rfq_data.delivery_location),
        required_certifications=sanitized_data.get('required_certifications', rfq_data.required_certifications),
        preferred_suppliers=sanitized_data.get('preferred_suppliers', rfq_data.preferred_suppliers),
        attachments=rfq_data.attachments,
        visibility=rfq_data.visibility,
        expires_at=expires_at
    )
    
    db.add(rfq)
    db.commit()
    db.refresh(rfq)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=user.id,
        action="rfq.create",
        status="success",
        resource_type="rfq",
        resource_id=str(rfq.id),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        status_code=200,
        details={
            "title": rfq.title,
            "material_category": rfq.material_category,
            "quantity": rfq.quantity,
            "visibility": rfq.visibility
        }
    )
    
    return RFQResponseSchema(
        id=str(rfq.id),
        title=rfq.title,
        material_category=rfq.material_category,
        quantity=rfq.quantity,
        target_price=rfq.target_price,
        specifications=rfq.specifications,
        delivery_deadline=rfq.delivery_deadline,
        delivery_location=rfq.delivery_location,
        status=rfq.status,
        visibility=rfq.visibility,
        expires_at=rfq.expires_at,
        view_count=rfq.view_count,
        response_count=rfq.response_count,
        created_at=rfq.created_at,
        buyer_company_name=poc.company.name if poc.company else None
    )


@router.get("", response_model=List[RFQList])
async def list_rfqs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    material_category: Optional[str] = Query(None),
    status: Optional[str] = Query("active"),
    search: Optional[str] = Query(None),
    organization_id: Optional[str] = Query(None, description="Filter by organization"),
    db: Session = Depends(get_db)
):
    """
    List RFQs with filtering and pagination.
    Supports organization-scoped queries via organization_id parameter.
    """
    query = db.query(RFQ)
    
    # Apply filters
    if status:
        query = query.filter(RFQ.status == status)
    
    if material_category:
        query = query.filter(RFQ.material_category.ilike(f"%{material_category}%"))
    
    if search:
        query = query.filter(
            or_(
                RFQ.title.ilike(f"%{search}%"),
                RFQ.specifications.ilike(f"%{search}%"),
                RFQ.material_category.ilike(f"%{search}%")
            )
        )
    
    # Organization-scoped filtering (tenant isolation)
    if organization_id:
        query = query.filter(RFQ.organization_id == organization_id)
    else:
        # Without org scope, only show public RFQs that haven't expired
        query = query.filter(
            and_(
                RFQ.visibility == "public",
                or_(RFQ.expires_at.is_(None), RFQ.expires_at > datetime.utcnow())
            )
        )
    
    # Order by creation date (newest first)
    query = query.order_by(RFQ.created_at.desc())
    
    # Apply pagination
    rfqs = query.offset(skip).limit(limit).all()
    
    # Convert to response format
    result = []
    for rfq in rfqs:
        # Get buyer company name
        buyer_company = db.query(Company).filter(Company.id == rfq.buyer_company_id).first()
        
        result.append(RFQList(
            id=str(rfq.id),
            title=rfq.title,
            material_category=rfq.material_category,
            quantity=rfq.quantity,
            target_price=rfq.target_price,
            delivery_deadline=rfq.delivery_deadline,
            status=rfq.status,
            expires_at=rfq.expires_at,
            view_count=rfq.view_count,
            response_count=rfq.response_count,
            created_at=rfq.created_at,
            buyer_company_name=buyer_company.name if buyer_company else None
        ))
    
    return result


@router.get("/{rfq_id}", response_model=RFQDetail)
async def get_rfq(
    rfq_id: str,
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
):
    """
    Get detailed RFQ information
    """
    try:
        rfq_uuid = uuid.UUID(rfq_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid RFQ ID format"
        )
    
    rfq = db.query(RFQ).filter(RFQ.id == rfq_uuid).first()
    if not rfq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RFQ not found"
        )
    
    # Check if RFQ is accessible
    current_user = None
    if credentials:
        current_user = get_current_user(db, credentials.credentials)
    
    # Only owner or public RFQs can be viewed
    if rfq.visibility != "public" and (not current_user or rfq.buyer_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this RFQ"
        )
    
    # Increment view count
    rfq.view_count += 1
    db.commit()
    
    # Audit log (only if authenticated)
    if current_user:
        audit_service.log_action(
            db=db,
            user_id=current_user.id,
            action="rfq.view",
            status="success",
            resource_type="rfq",
            resource_id=str(rfq.id),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            status_code=200,
            details={"title": rfq.title}
        )
    
    # Get buyer company info
    buyer_company = db.query(Company).filter(Company.id == rfq.buyer_company_id).first()
    
    # Get responses count
    response_count = db.query(RFQResponse).filter(RFQResponse.rfq_id == rfq.id).count()
    
    return RFQDetail(
        id=str(rfq.id),
        title=rfq.title,
        material_category=rfq.material_category,
        quantity=rfq.quantity,
        target_price=rfq.target_price,
        specifications=rfq.specifications,
        delivery_deadline=rfq.delivery_deadline,
        delivery_location=rfq.delivery_location,
        required_certifications=rfq.required_certifications,
        preferred_suppliers=rfq.preferred_suppliers,
        attachments=rfq.attachments,
        status=rfq.status,
        visibility=rfq.visibility,
        expires_at=rfq.expires_at,
        view_count=rfq.view_count,
        response_count=response_count,
        created_at=rfq.created_at,
        updated_at=rfq.updated_at,
        buyer_company_name=buyer_company.name if buyer_company else None,
        buyer_company_id=str(rfq.buyer_company_id)
    )


@router.put("/{rfq_id}", response_model=RFQResponseSchema)
async def update_rfq(
    rfq_id: str,
    rfq_update: RFQUpdate,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """
    Update an existing RFQ (only by owner)
    """
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    try:
        rfq_uuid = uuid.UUID(rfq_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid RFQ ID format"
        )
    
    rfq = db.query(RFQ).filter(RFQ.id == rfq_uuid).first()
    if not rfq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RFQ not found"
        )
    
    # Check ownership
    if rfq.buyer_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the RFQ owner can update it"
        )
    
    # Track what changed
    changes = {}
    update_data = rfq_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        old_value = getattr(rfq, field)
        if old_value != value:
            changes[field] = {"old": str(old_value), "new": str(value)}
        setattr(rfq, field, value)
    
    rfq.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(rfq)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=user.id,
        action="rfq.update",
        status="success",
        resource_type="rfq",
        resource_id=str(rfq.id),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        status_code=200,
        details={"changes": changes}
    )
    
    return RFQResponseSchema(
        id=str(rfq.id),
        title=rfq.title,
        material_category=rfq.material_category,
        quantity=rfq.quantity,
        target_price=rfq.target_price,
        specifications=rfq.specifications,
        delivery_deadline=rfq.delivery_deadline,
        delivery_location=rfq.delivery_location,
        status=rfq.status,
        visibility=rfq.visibility,
        expires_at=rfq.expires_at,
        view_count=rfq.view_count,
        response_count=rfq.response_count,
        created_at=rfq.created_at
    )


@router.delete("/{rfq_id}")
async def delete_rfq(
    rfq_id: str,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """
    Delete an RFQ (only by owner)
    """
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    try:
        rfq_uuid = uuid.UUID(rfq_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid RFQ ID format"
        )
    
    rfq = db.query(RFQ).filter(RFQ.id == rfq_uuid).first()
    if not rfq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RFQ not found"
        )
    
    # Check ownership
    if rfq.buyer_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the RFQ owner can delete it"
        )
    
    # Save details before deletion
    rfq_details = {
        "title": rfq.title,
        "material_category": rfq.material_category,
        "status": rfq.status
    }
    
    db.delete(rfq)
    db.commit()
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=user.id,
        action="rfq.delete",
        status="success",
        resource_type="rfq",
        resource_id=str(rfq_uuid),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        status_code=200,
        details=rfq_details
    )
    
    return {"message": "RFQ deleted successfully"}


@router.post("/{rfq_id}/responses")
async def submit_rfq_response(
    rfq_id: str,
    response_data: RFQResponseCreate,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """
    Submit a response to an RFQ
    """
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    try:
        rfq_uuid = uuid.UUID(rfq_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid RFQ ID format"
        )
    
    rfq = db.query(RFQ).filter(RFQ.id == rfq_uuid).first()
    if not rfq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RFQ not found"
        )
    
    # Check if RFQ is still active and not expired
    if rfq.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot respond to inactive RFQ"
        )
    
    if rfq.expires_at and rfq.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="RFQ has expired"
        )
    
    # Get user's POC relationship
    poc = db.query(POC).filter(POC.user_id == user.id).first()
    if not poc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be associated with a company to respond to RFQs"
        )
    
    # Check if company already responded
    existing_response = db.query(RFQResponse).filter(
        and_(
            RFQResponse.rfq_id == rfq.id,
            RFQResponse.supplier_company_id == poc.company_id
        )
    ).first()
    
    if existing_response:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company has already responded to this RFQ"
        )
    
    # Create response
    rfq_response = RFQResponse(
        rfq_id=rfq.id,
        supplier_company_id=poc.company_id,
        responding_poc_id=poc.id,
        price_quote=response_data.price_quote,
        lead_time_days=response_data.lead_time_days,
        minimum_order_quantity=response_data.minimum_order_quantity,
        message=response_data.message,
        attachments=response_data.attachments,
        certifications_provided=response_data.certifications_provided,
        responded_at=datetime.utcnow()
    )
    
    db.add(rfq_response)
    
    # Update RFQ response count
    rfq.response_count += 1
    
    db.commit()
    db.refresh(rfq_response)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=user.id,
        action="rfq.response.submit",
        status="success",
        resource_type="rfq_response",
        resource_id=str(rfq_response.id),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        status_code=200,
        details={
            "rfq_id": str(rfq.id),
            "rfq_title": rfq.title,
            "price_quote": response_data.price_quote,
            "lead_time_days": response_data.lead_time_days
        }
    )
    
    return {"message": "Response submitted successfully", "response_id": str(rfq_response.id)}


@router.get("/{rfq_id}/responses")
async def get_rfq_responses(
    rfq_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """
    Get all responses for an RFQ (only for RFQ owner)
    """
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    try:
        rfq_uuid = uuid.UUID(rfq_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid RFQ ID format"
        )
    
    rfq = db.query(RFQ).filter(RFQ.id == rfq_uuid).first()
    if not rfq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RFQ not found"
        )
    
    # Check ownership
    if rfq.buyer_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the RFQ owner can view responses"
        )
    
    # Get all responses
    responses = db.query(RFQResponse).filter(RFQResponse.rfq_id == rfq.id).all()
    
    result = []
    for response in responses:
        # Get supplier company info
        company = db.query(Company).filter(Company.id == response.supplier_company_id).first()
        poc = db.query(POC).filter(POC.id == response.responding_poc_id).first()
        
        result.append({
            "id": str(response.id),
            "supplier_company_name": company.name if company else None,
            "supplier_company_id": str(response.supplier_company_id),
            "responding_poc_name": poc.user.name if poc and poc.user else None,
            "price_quote": response.price_quote,
            "lead_time_days": response.lead_time_days,
            "minimum_order_quantity": response.minimum_order_quantity,
            "message": response.message,
            "status": response.status,
            "responded_at": response.responded_at,
            "created_at": response.created_at
        })
    
    return result