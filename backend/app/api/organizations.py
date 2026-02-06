from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List
import uuid
import re

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.organization import Organization, Role, OrgMember
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    RoleResponse,
    OrgMemberCreate,
    OrgMemberResponse,
)

router = APIRouter(tags=["organizations"])
security = HTTPBearer()


def _slugify(name: str) -> str:
    """Generate a URL-friendly slug from an organization name."""
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


def _ensure_unique_slug(db: Session, base_slug: str) -> str:
    """Append a numeric suffix if the slug already exists."""
    slug = base_slug
    counter = 1
    while db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1
    return slug


# ---------- Organization CRUD ----------

@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    org_data: OrganizationCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Create a new organization. The creator is automatically assigned the org_admin role."""
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    slug = _ensure_unique_slug(db, _slugify(org_data.name))

    org = Organization(
        name=org_data.name,
        slug=slug,
        owner_id=user.id,
    )
    db.add(org)
    db.flush()

    # Resolve org_admin role
    admin_role = db.query(Role).filter(Role.name == "org_admin").first()

    member = OrgMember(
        organization_id=org.id,
        user_id=user.id,
        role_id=admin_role.id if admin_role else None,
        invited_by=user.id,
    )
    db.add(member)
    db.commit()
    db.refresh(org)

    return OrganizationResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        owner_id=org.owner_id,
        logo_url=org.logo_url,
        plan_tier=org.plan_tier,
        is_active=org.is_active,
        created_at=org.created_at,
    )


@router.get("", response_model=List[OrganizationResponse])
async def list_organizations(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """List organizations the current user belongs to."""
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    memberships = (
        db.query(OrgMember)
        .filter(OrgMember.user_id == user.id, OrgMember.is_active == True)
        .all()
    )
    org_ids = [m.organization_id for m in memberships]
    orgs = db.query(Organization).filter(Organization.id.in_(org_ids)).all() if org_ids else []

    return [
        OrganizationResponse(
            id=o.id,
            name=o.name,
            slug=o.slug,
            owner_id=o.owner_id,
            logo_url=o.logo_url,
            plan_tier=o.plan_tier,
            is_active=o.is_active,
            created_at=o.created_at,
        )
        for o in orgs
    ]


@router.get("/roles", response_model=List[RoleResponse])
async def list_roles(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """List all available roles."""
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    roles = db.query(Role).all()
    return [
        RoleResponse(
            id=r.id,
            name=r.name,
            display_name=r.display_name,
            description=r.description,
            permissions=r.permissions or [],
        )
        for r in roles
    ]


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Get organization details (must be a member)."""
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    membership = (
        db.query(OrgMember)
        .filter(OrgMember.organization_id == org_id, OrgMember.user_id == user.id, OrgMember.is_active == True)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    return OrganizationResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        owner_id=org.owner_id,
        logo_url=org.logo_url,
        plan_tier=org.plan_tier,
        is_active=org.is_active,
        created_at=org.created_at,
    )


@router.put("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: uuid.UUID,
    org_data: OrganizationUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Update organization (owner or org_admin only)."""
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    # Check ownership or admin role
    if org.owner_id != user.id:
        membership = (
            db.query(OrgMember)
            .join(Role, OrgMember.role_id == Role.id)
            .filter(
                OrgMember.organization_id == org_id,
                OrgMember.user_id == user.id,
                OrgMember.is_active == True,
                Role.name == "org_admin",
            )
            .first()
        )
        if not membership:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can update the organization")

    if org_data.name is not None:
        org.name = org_data.name
        org.slug = _ensure_unique_slug(db, _slugify(org_data.name))
    if org_data.logo_url is not None:
        org.logo_url = org_data.logo_url
    if org_data.settings is not None:
        org.settings = org_data.settings

    db.commit()
    db.refresh(org)

    return OrganizationResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        owner_id=org.owner_id,
        logo_url=org.logo_url,
        plan_tier=org.plan_tier,
        is_active=org.is_active,
        created_at=org.created_at,
    )


# ---------- Members ----------

@router.post("/{org_id}/members", response_model=OrgMemberResponse, status_code=status.HTTP_201_CREATED)
async def invite_member(
    org_id: uuid.UUID,
    member_data: OrgMemberCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Invite a user to the organization by email and role name."""
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    # Only owner or org_admin can invite
    if org.owner_id != user.id:
        admin_membership = (
            db.query(OrgMember)
            .join(Role, OrgMember.role_id == Role.id)
            .filter(
                OrgMember.organization_id == org_id,
                OrgMember.user_id == user.id,
                OrgMember.is_active == True,
                Role.name == "org_admin",
            )
            .first()
        )
        if not admin_membership:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can invite members")

    # Find target user
    target_user = db.query(User).filter(User.email == member_data.user_email.lower().strip()).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User with that email not found")

    # Check existing membership
    existing = (
        db.query(OrgMember)
        .filter(OrgMember.organization_id == org_id, OrgMember.user_id == target_user.id)
        .first()
    )
    if existing:
        if existing.is_active:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a member")
        # Reactivate
        existing.is_active = True

    # Resolve role
    role = db.query(Role).filter(Role.name == member_data.role_name).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Role '{member_data.role_name}' not found")

    if existing:
        existing.role_id = role.id
        db.commit()
        db.refresh(existing)
        member = existing
    else:
        member = OrgMember(
            organization_id=org_id,
            user_id=target_user.id,
            role_id=role.id,
            invited_by=user.id,
        )
        db.add(member)
        db.commit()
        db.refresh(member)

    role_name = role.name if role else None

    return OrgMemberResponse(
        id=member.id,
        organization_id=member.organization_id,
        user_id=member.user_id,
        role_name=role_name,
        joined_at=member.joined_at,
        is_active=member.is_active,
    )


@router.get("/{org_id}/members", response_model=List[OrgMemberResponse])
async def list_members(
    org_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """List members of an organization."""
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Verify membership
    membership = (
        db.query(OrgMember)
        .filter(OrgMember.organization_id == org_id, OrgMember.user_id == user.id, OrgMember.is_active == True)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    members = (
        db.query(OrgMember)
        .filter(OrgMember.organization_id == org_id, OrgMember.is_active == True)
        .all()
    )

    result = []
    for m in members:
        role_name = m.role.name if m.role else None
        result.append(
            OrgMemberResponse(
                id=m.id,
                organization_id=m.organization_id,
                user_id=m.user_id,
                role_name=role_name,
                joined_at=m.joined_at,
                is_active=m.is_active,
            )
        )
    return result


@router.delete("/{org_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    org_id: uuid.UUID,
    member_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Remove a member from the organization (owner/admin only). Cannot remove the owner."""
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    # Only owner or org_admin can remove
    if org.owner_id != user.id:
        admin_membership = (
            db.query(OrgMember)
            .join(Role, OrgMember.role_id == Role.id)
            .filter(
                OrgMember.organization_id == org_id,
                OrgMember.user_id == user.id,
                OrgMember.is_active == True,
                Role.name == "org_admin",
            )
            .first()
        )
        if not admin_membership:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can remove members")

    member = (
        db.query(OrgMember)
        .filter(OrgMember.id == member_id, OrgMember.organization_id == org_id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if member.user_id == org.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove the organization owner")

    member.is_active = False
    db.commit()
