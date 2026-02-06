"""
RBAC (Role-Based Access Control) middleware / dependency for FastAPI.

Usage in a route:

    from app.middleware.rbac import require_permission

    @router.post("/sensitive-action")
    async def sensitive(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        db: Session = Depends(get_db),
        _: None = Depends(require_permission("rfq.create")),
    ):
        ...
"""

from typing import List, Optional, Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import uuid

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.organization import OrgMember, Role

security = HTTPBearer()


def get_user_permissions(db: Session, user_id: uuid.UUID, org_id: uuid.UUID) -> List[str]:
    """
    Return the flat list of permission strings a user holds in a given organization.

    Permissions are stored as a JSON list on the Role model
    (e.g. ["rfq.create", "rfq.view", "members.invite"]).
    """
    membership = (
        db.query(OrgMember)
        .filter(
            OrgMember.user_id == user_id,
            OrgMember.organization_id == org_id,
            OrgMember.is_active == True,
        )
        .first()
    )
    if not membership or not membership.role_id:
        return []

    role = db.query(Role).filter(Role.id == membership.role_id).first()
    if not role:
        return []

    return role.permissions or []


def require_permission(permission: str, org_id_param: str = "org_id") -> Callable:
    """
    Return a FastAPI dependency that verifies the current user holds *permission*
    in the organization identified by the path parameter ``org_id_param``.

    Raises 403 if the permission is missing, 401 if unauthenticated.

    Usage::

        @router.post("/{org_id}/do-something",
                      dependencies=[Depends(require_permission("some.action"))])
        async def do_something(org_id: uuid.UUID, ...):
            ...
    """

    async def _check(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        db: Session = Depends(get_db),
        **path_params,
    ):
        user = get_current_user(db, credentials.credentials)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        org_id: Optional[uuid.UUID] = path_params.get(org_id_param)
        if org_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing path parameter '{org_id_param}'",
            )

        perms = get_user_permissions(db, user.id, org_id)
        if permission not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission}",
            )

    return _check
