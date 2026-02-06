"""
Notification creation service.

Provides helper functions to create Notification records for various RFQ lifecycle events.
These are service functions — not endpoints — called from API routes or background tasks.
"""

from typing import Optional, Any, Dict
from sqlalchemy.orm import Session
import uuid
import asyncio
import logging

from app.models.rfq_extended import Notification, RFQInvitation, RFQAward
from app.models.user import RFQ, RFQResponse, POC
from app.services.websocket import pusher_service

logger = logging.getLogger(__name__)


def _fire_and_forget(coro):
    """Run an async coroutine from sync code without blocking."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(coro)
    except RuntimeError:
        # No running loop – create one just for this call
        try:
            asyncio.run(coro)
        except Exception:
            pass


def create_notification(
    db: Session,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
    action_url: Optional[str] = None,
) -> Notification:
    """Create and persist a new notification for a user."""
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        data=data or {},
        action_url=action_url,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    # Push real-time notification via Pusher (best-effort)
    try:
        _fire_and_forget(
            pusher_service.notify_deal_milestone(
                rfq_id=data.get("rfq_id", "") if data else "",
                milestone=type,
                participants=[str(user_id)],
                details={"title": title, "body": body, "action_url": action_url},
            )
        )
    except Exception as e:
        logger.warning(f"Pusher push failed for notification {type}: {e}")

    return notification


def notify_rfq_response(db: Session, rfq: RFQ, response: RFQResponse) -> Optional[Notification]:
    """
    Notify the RFQ owner when a supplier submits a response.
    """
    try:
        supplier_company = response.supplier_company
        supplier_name = supplier_company.name if supplier_company else "A supplier"

        notification = create_notification(
            db=db,
            user_id=rfq.buyer_id,
            type="rfq_response",
            title="New RFQ Response Received",
            body=f"{supplier_name} has responded to your RFQ: {rfq.title}",
            data={
                "rfq_id": str(rfq.id),
                "response_id": str(response.id),
                "supplier_company_id": str(response.supplier_company_id),
            },
            action_url=f"/rfqs/{rfq.id}/responses/{response.id}",
        )

        # Pusher: real-time new-response event
        try:
            _fire_and_forget(
                pusher_service.notify_new_rfq_response(
                    rfq_id=str(rfq.id),
                    supplier_name=supplier_name,
                    response_id=str(response.id),
                    buyer_user_id=str(rfq.buyer_id),
                )
            )
        except Exception as e:
            logger.warning(f"Pusher notify_new_rfq_response failed: {e}")

        return notification
    except Exception as e:
        logger.error(f"Failed to create rfq_response notification: {e}")
        return None


def notify_rfq_awarded(db: Session, award: RFQAward) -> Optional[Notification]:
    """
    Notify the winning supplier when an RFQ is awarded to their response.
    """
    try:
        response = db.query(RFQResponse).filter(RFQResponse.id == award.response_id).first()
        if not response:
            return None

        rfq = db.query(RFQ).filter(RFQ.id == award.rfq_id).first()
        rfq_title = rfq.title if rfq else "an RFQ"

        # Find the supplier POC user
        poc = db.query(POC).filter(POC.id == response.responding_poc_id).first()
        if not poc:
            return None

        notification = create_notification(
            db=db,
            user_id=poc.user_id,
            type="rfq_awarded",
            title="Congratulations — RFQ Awarded!",
            body=f"Your response to \"{rfq_title}\" has been selected.",
            data={
                "rfq_id": str(award.rfq_id),
                "award_id": str(award.id),
                "response_id": str(award.response_id),
            },
            action_url=f"/rfqs/{award.rfq_id}/awards/{award.id}",
        )

        # Pusher: deal milestone for award
        try:
            _fire_and_forget(
                pusher_service.notify_deal_milestone(
                    rfq_id=str(award.rfq_id),
                    milestone="quote_accepted",
                    participants=[str(poc.user_id)],
                    details={
                        "award_id": str(award.id),
                        "rfq_title": rfq_title,
                    },
                )
            )
        except Exception as e:
            logger.warning(f"Pusher notify_deal_milestone (award) failed: {e}")

        return notification
    except Exception as e:
        logger.error(f"Failed to create rfq_awarded notification: {e}")
        return None


def notify_rfq_invitation(db: Session, invitation: RFQInvitation) -> Optional[Notification]:
    """
    Notify primary POCs of the invited supplier company about a new RFQ invitation.
    """
    try:
        rfq = db.query(RFQ).filter(RFQ.id == invitation.rfq_id).first()
        rfq_title = rfq.title if rfq else "an RFQ"

        # Get primary POCs for the supplier company
        pocs = (
            db.query(POC)
            .filter(POC.company_id == invitation.supplier_company_id, POC.is_primary == True)
            .all()
        )
        if not pocs:
            # Fallback: notify all POCs
            pocs = db.query(POC).filter(POC.company_id == invitation.supplier_company_id).all()

        last_notification = None
        poc_user_ids = []
        for poc in pocs:
            last_notification = create_notification(
                db=db,
                user_id=poc.user_id,
                type="rfq_invitation",
                title="New RFQ Invitation",
                body=f"You have been invited to respond to: {rfq_title}",
                data={
                    "rfq_id": str(invitation.rfq_id),
                    "invitation_id": str(invitation.id),
                },
                action_url=f"/rfqs/{invitation.rfq_id}",
            )
            poc_user_ids.append(str(poc.user_id))

        # Pusher: bulk match notification to invited suppliers
        if poc_user_ids:
            try:
                matched_suppliers = [{"user_id": uid, "match_score": 1.0} for uid in poc_user_ids]
                _fire_and_forget(
                    pusher_service.notify_bulk_rfq_match(
                        rfq_id=str(invitation.rfq_id),
                        rfq_title=rfq_title,
                        matched_suppliers=matched_suppliers,
                    )
                )
            except Exception as e:
                logger.warning(f"Pusher notify_bulk_rfq_match (invitation) failed: {e}")

        return last_notification
    except Exception as e:
        logger.error(f"Failed to create rfq_invitation notification: {e}")
        return None


def notify_rfq_expiring(db: Session, rfq: RFQ) -> Optional[Notification]:
    """
    Notify the RFQ owner when their RFQ is about to expire.
    """
    try:
        notification = create_notification(
            db=db,
            user_id=rfq.buyer_id,
            type="rfq_expiring",
            title="RFQ Expiring Soon",
            body=f"Your RFQ \"{rfq.title}\" is expiring soon. Consider extending the deadline.",
            data={
                "rfq_id": str(rfq.id),
                "expires_at": rfq.expires_at.isoformat() if rfq.expires_at else None,
            },
            action_url=f"/rfqs/{rfq.id}",
        )

        # Pusher: expiring-soon notification to RFQ owner
        try:
            _fire_and_forget(
                pusher_service.notify_rfq_expiring_soon(
                    rfq_id=str(rfq.id),
                    rfq_title=rfq.title,
                    expires_in_hours=24,  # default; caller can refine
                    interested_suppliers=[str(rfq.buyer_id)],
                )
            )
        except Exception as e:
            logger.warning(f"Pusher notify_rfq_expiring_soon failed: {e}")

        return notification
    except Exception as e:
        logger.error(f"Failed to create rfq_expiring notification: {e}")
        return None
