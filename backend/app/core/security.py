from datetime import datetime, timedelta
from typing import Optional, Union, Any
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import ValidationError
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import re
import httpx
import os
import logging

from app.core.config import settings
from app.schemas.token import TokenPayload

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
security = HTTPBearer()

# Supabase configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")


def validate_password_strength(password: str) -> tuple[bool, Optional[str]]:
    """
    Validate password strength according to SOC 2 requirements.
    """
    min_length = settings.password_min_length

    if len(password) < min_length:
        return False, f"Password must be at least {min_length} characters long"

    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"

    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"

    if not re.search(r"\d", password):
        return False, "Password must contain at least one number"

    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password):
        return False, "Password must contain at least one special character (!@#$%^&* etc.)"

    common_passwords = [
        "password", "123456", "12345678", "qwerty", "abc123", "monkey",
        "password123", "admin123", "letmein", "welcome", "password1",
        "admin", "administrator", "root", "toor", "pass", "test"
    ]

    if password.lower() in common_passwords:
        return False, "Password is too common. Please choose a more unique password"

    return True, None


def create_access_token(
    subject: Union[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """Create a JWT access token"""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=30)
    to_encode = {"exp": expire, "sub": str(subject), "iat": datetime.utcnow()}
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def create_refresh_token(subject: Union[str, Any]) -> str:
    """Create a JWT refresh token"""
    expire = datetime.utcnow() + timedelta(hours=24)
    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh", "iat": datetime.utcnow()}
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def verify_token(token: str) -> Optional[TokenPayload]:
    """Verify and decode a local JWT token"""
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        token_data = TokenPayload(**payload)
    except (JWTError, ValidationError):
        return None
    return token_data


def verify_supabase_token_sync(token: str) -> Optional[dict]:
    """Synchronous Supabase token verification"""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return None
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": SUPABASE_ANON_KEY
                }
            )
            if response.status_code == 200:
                return response.json()
            return None
    except Exception as e:
        logger.warning(f"Supabase token verification error: {e}")
        return None


def authenticate_user(db: Session, email: str, password: str) -> Optional[Any]:
    """Authenticate a user by email and password"""
    from app.models.user import User
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if not user.hashed_password:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def get_current_user(db_or_credentials=None, token_str: str = None):
    """
    Unified auth: resolves current user from token.
    
    Supports two call patterns:
    1. get_current_user(db: Session, token: str) — called from route handlers directly
    2. get_current_user(credentials: HTTPAuthorizationCredentials) — FastAPI dependency
    
    Strategy: try local JWT first (fast, no network), then Supabase token.
    """
    from app.models.user import User
    from app.core.database import SessionLocal

    # Determine the token string
    if token_str is not None:
        # Pattern 1: called as get_current_user(db, token)
        token = token_str
        db = db_or_credentials
        owns_db = False
    elif hasattr(db_or_credentials, 'credentials'):
        # Pattern 2: FastAPI dependency injection
        token = db_or_credentials.credentials
        db = SessionLocal()
        owns_db = True
    else:
        raise HTTPException(status_code=401, detail="No credentials provided")

    user = None
    try:
        # Strategy 1: Local JWT
        token_data = verify_token(token)
        if token_data and token_data.sub:
            user = db.query(User).filter(User.id == token_data.sub).first()

        # Strategy 2: Supabase token
        if not user:
            supa_data = verify_supabase_token_sync(token)
            if supa_data:
                supa_email = supa_data.get("email")
                supa_id = supa_data.get("id")
                if supa_email:
                    user = db.query(User).filter(User.email == supa_email).first()
                if not user and supa_id:
                    user = db.query(User).filter(User.id == supa_id).first()

        if not user:
            raise HTTPException(status_code=401, detail="Could not validate credentials")

        return user
    finally:
        if owns_db:
            db.close()