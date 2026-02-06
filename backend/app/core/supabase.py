"""
Supabase client configuration for backend
"""
import os
import logging
from supabase import create_client, Client
from functools import lru_cache

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")


@lru_cache()
def get_supabase_client() -> Client:
    """Get cached Supabase client instance"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required. "
            "See .env.example for configuration."
        )
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_supabase() -> Client:
    """Dependency for FastAPI routes"""
    return get_supabase_client()
