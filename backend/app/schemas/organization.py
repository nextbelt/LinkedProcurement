from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime
import uuid


class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    logo_url: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    owner_id: Optional[uuid.UUID] = None
    logo_url: Optional[str] = None
    plan_tier: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class RoleResponse(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str
    description: Optional[str] = None
    permissions: List[str] = []

    class Config:
        from_attributes = True


class OrgMemberCreate(BaseModel):
    user_email: str = Field(..., description="Email of the user to invite")
    role_name: str = Field(..., description="Name of the role to assign")


class OrgMemberResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: uuid.UUID
    role_name: Optional[str] = None
    joined_at: datetime
    is_active: bool

    class Config:
        from_attributes = True
