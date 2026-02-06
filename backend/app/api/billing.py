from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import stripe
import os
from uuid import UUID

from app.core.database import get_db
from app.models.user import User, Subscription, Invoice
from app.api.auth import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")


class CreateCheckoutSessionRequest(BaseModel):
    tier: str  # pro, premium
    billing_cycle: str  # monthly, annual


class CreateCheckoutSessionResponse(BaseModel):
    checkout_url: str
    session_id: str


class SubscriptionResponse(BaseModel):
    id: str
    tier: str
    status: str
    billing_cycle: str
    price_amount: float
    current_period_start: Optional[datetime]
    current_period_end: Optional[datetime]
    cancelled_at: Optional[datetime]
    rfq_limit: Optional[int]
    rfqs_posted_this_month: int
    response_limit: Optional[int]
    responses_sent_this_month: int

    class Config:
        from_attributes = True


class InvoiceResponse(BaseModel):
    id: str
    invoice_number: str
    amount: float
    status: str
    period_start: datetime
    period_end: datetime
    paid_at: Optional[datetime]
    invoice_pdf_url: Optional[str]

    class Config:
        from_attributes = True


# Pricing configuration
PRICING = {
    "pro": {
        "monthly": 99.00,
        "annual": 948.00,  # 20% discount
        "rfq_limit": 50,
        "response_limit": None,  # Unlimited
        "stripe_price_id_monthly": "price_pro_monthly",  # Replace with actual Stripe price ID
        "stripe_price_id_annual": "price_pro_annual"
    },
    "premium": {
        "monthly": 299.00,
        "annual": 2868.00,  # 20% discount
        "rfq_limit": None,  # Unlimited
        "response_limit": None,  # Unlimited
        "stripe_price_id_monthly": "price_premium_monthly",
        "stripe_price_id_annual": "price_premium_annual"
    }
}


@router.post("/create-checkout-session", response_model=CreateCheckoutSessionResponse)
async def create_checkout_session(
    request: CreateCheckoutSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a Stripe Checkout session for subscription purchase"""
    
    if request.tier not in ["pro", "premium"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid subscription tier"
        )
    
    if request.billing_cycle not in ["monthly", "annual"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid billing cycle"
        )
    
    # Get pricing info
    tier_pricing = PRICING[request.tier]
    price_amount = tier_pricing[request.billing_cycle]
    
    # Get or create Stripe customer
    subscription = db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
    
    if subscription and subscription.stripe_customer_id:
        customer_id = subscription.stripe_customer_id
    else:
        # Create new Stripe customer
        try:
            customer = stripe.Customer.create(
                email=current_user.email,
                name=current_user.name,
                metadata={
                    "user_id": str(current_user.id)
                }
            )
            customer_id = customer.id
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create Stripe customer: {str(e)}"
            )
    
    # Create Checkout session
    try:
        # Determine price ID based on tier and billing cycle
        if request.billing_cycle == "monthly":
            price_id = tier_pricing["stripe_price_id_monthly"]
        else:
            price_id = tier_pricing["stripe_price_id_annual"]
        
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[
                {
                    "price": price_id,
                    "quantity": 1,
                }
            ],
            mode="subscription",
            success_url=f"{os.getenv('FRONTEND_URL', 'http://localhost:3001')}/dashboard/billing?success=true",
            cancel_url=f"{os.getenv('FRONTEND_URL', 'http://localhost:3001')}/pricing?cancelled=true",
            metadata={
                "user_id": str(current_user.id),
                "tier": request.tier,
                "billing_cycle": request.billing_cycle
            }
        )
        
        return CreateCheckoutSessionResponse(
            checkout_url=checkout_session.url,
            session_id=checkout_session.id
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create checkout session: {str(e)}"
        )


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's subscription details"""
    
    subscription = db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
    
    if not subscription:
        # Create default free subscription
        subscription = Subscription(
            user_id=current_user.id,
            tier="free",
            status="active",
            billing_cycle="monthly",
            price_amount=0,
            rfq_limit=3,
            rfqs_posted_this_month=0,
            response_limit=10,
            responses_sent_this_month=0
        )
        db.add(subscription)
        db.commit()
        db.refresh(subscription)
    
    return SubscriptionResponse(
        id=str(subscription.id),
        tier=subscription.tier,
        status=subscription.status,
        billing_cycle=subscription.billing_cycle,
        price_amount=float(subscription.price_amount) if subscription.price_amount else 0.0,
        current_period_start=subscription.current_period_start,
        current_period_end=subscription.current_period_end,
        cancelled_at=subscription.cancelled_at,
        rfq_limit=subscription.rfq_limit,
        rfqs_posted_this_month=subscription.rfqs_posted_this_month,
        response_limit=subscription.response_limit,
        responses_sent_this_month=subscription.responses_sent_this_month
    )


@router.get("/invoices", response_model=List[InvoiceResponse])
async def get_invoices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's invoice history"""
    
    subscription = db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
    
    if not subscription:
        return []
    
    invoices = db.query(Invoice).filter(
        Invoice.subscription_id == subscription.id
    ).order_by(Invoice.created_at.desc()).all()
    
    return [
        InvoiceResponse(
            id=str(invoice.id),
            invoice_number=invoice.invoice_number,
            amount=float(invoice.amount),
            status=invoice.status,
            period_start=invoice.period_start,
            period_end=invoice.period_end,
            paid_at=invoice.paid_at,
            invoice_pdf_url=invoice.invoice_pdf_url
        )
        for invoice in invoices
    ]


@router.post("/cancel-subscription")
async def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel user's subscription (at end of billing period)"""
    
    subscription = db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
    
    if not subscription or subscription.tier == "free":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active subscription to cancel"
        )
    
    if subscription.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subscription already cancelled"
        )
    
    # Cancel Stripe subscription
    if subscription.stripe_subscription_id:
        try:
            stripe.Subscription.modify(
                subscription.stripe_subscription_id,
                cancel_at_period_end=True
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to cancel Stripe subscription: {str(e)}"
            )
    
    # Update subscription status
    subscription.status = "cancelled"
    subscription.cancelled_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Subscription cancelled successfully. Access will continue until end of billing period."}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle Stripe webhook events with signature verification"""
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    
    # Read raw body for signature verification
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    
    if not webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe webhook secret not configured"
        )
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    event_type = event["type"]
    data = event["data"]["object"]
    
    if event_type == "checkout.session.completed":
        # Handle successful checkout
        user_id = UUID(data.get("metadata", {}).get("user_id"))
        tier = data.get("metadata", {}).get("tier")
        billing_cycle = data.get("metadata", {}).get("billing_cycle")
        
        subscription = db.query(Subscription).filter(Subscription.user_id == user_id).first()
        
        if not subscription:
            subscription = Subscription(user_id=user_id)
            db.add(subscription)
        
        # Update subscription
        subscription.tier = tier
        subscription.status = "active"
        subscription.billing_cycle = billing_cycle
        subscription.price_amount = PRICING[tier][billing_cycle]
        subscription.stripe_customer_id = data.get("customer")
        subscription.stripe_subscription_id = data.get("subscription")
        subscription.current_period_start = datetime.utcnow()
        
        if billing_cycle == "monthly":
            subscription.current_period_end = datetime.utcnow() + timedelta(days=30)
        else:
            subscription.current_period_end = datetime.utcnow() + timedelta(days=365)
        
        # Set limits based on tier
        tier_config = PRICING[tier]
        subscription.rfq_limit = tier_config["rfq_limit"]
        subscription.response_limit = tier_config["response_limit"]
        
        db.commit()
    
    elif event_type == "invoice.paid":
        # Create invoice record
        subscription_id = data.get("subscription")
        subscription = db.query(Subscription).filter(
            Subscription.stripe_subscription_id == subscription_id
        ).first()
        
        if subscription:
            invoice = Invoice(
                subscription_id=subscription.id,
                invoice_number=f"INV-{datetime.utcnow().strftime('%Y-%m')}-{data.get('number')}",
                amount=data.get("amount_paid") / 100,  # Convert cents to dollars
                currency="USD",
                status="paid",
                stripe_invoice_id=data.get("id"),
                period_start=datetime.fromtimestamp(data.get("period_start")),
                period_end=datetime.fromtimestamp(data.get("period_end")),
                paid_at=datetime.utcnow(),
                invoice_pdf_url=data.get("invoice_pdf")
            )
            db.add(invoice)
            db.commit()
    
    elif event_type == "customer.subscription.deleted":
        # Handle subscription cancellation
        subscription_id = data.get("id")
        subscription = db.query(Subscription).filter(
            Subscription.stripe_subscription_id == subscription_id
        ).first()
        
        if subscription:
            subscription.status = "cancelled"
            subscription.tier = "free"
            subscription.price_amount = 0
            subscription.rfq_limit = 3
            subscription.response_limit = 10
            db.commit()
    
    return {"status": "success"}
