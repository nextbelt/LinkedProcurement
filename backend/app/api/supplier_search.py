"""
Supplier Capability Search API routes.

Exposes the SearchService (Elasticsearch-backed) via REST endpoints:
- GET /api/v1/suppliers/search       — keyword + filter search
- GET /api/v1/suppliers/search/facets — aggregated facets only
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional, List
import logging
import os

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/suppliers", tags=["supplier-search"])
security = HTTPBearer()

# ---------------------------------------------------------------------------
# Lazy singleton – only create the SearchService when ES is reachable
# ---------------------------------------------------------------------------
_search_service = None


def _get_search_service():
    """Return a SearchService instance, or None if ES is not configured."""
    global _search_service
    if _search_service is not None:
        return _search_service

    es_url = settings.elasticsearch_url
    if not es_url or es_url.startswith("placeholder"):
        return None

    try:
        from app.services.search import SearchService
        _search_service = SearchService()
        return _search_service
    except Exception as e:
        logger.warning(f"Failed to initialise SearchService: {e}")
        return None


def _require_search_service():
    svc = _get_search_service()
    if svc is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supplier search is not available — Elasticsearch is not configured.",
        )
    return svc


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/search")
async def search_suppliers(
    q: Optional[str] = Query(None, description="Free-text keyword search"),
    materials: Optional[str] = Query(None, description="Comma-separated materials filter"),
    certifications: Optional[str] = Query(None, description="Comma-separated certifications filter"),
    location_state: Optional[str] = Query(None, description="State / region filter"),
    location_country: Optional[str] = Query(None, description="Country filter"),
    min_rating: Optional[float] = Query(None, ge=0, le=5, description="Minimum supplier rating"),
    min_response_rate: Optional[int] = Query(None, ge=0, le=100, description="Minimum response rate %"),
    max_response_time_hours: Optional[int] = Query(None, ge=0, description="Max avg response time (hours)"),
    verified_only: bool = Query(False, description="Only return verified suppliers"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Results per page"),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    Search suppliers by keyword, capabilities, certifications, and location.

    Requires authentication.  Returns paginated results with facets.
    """
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    svc = _require_search_service()

    materials_list = [m.strip() for m in materials.split(",")] if materials else None
    certs_list = [c.strip() for c in certifications.split(",")] if certifications else None

    location_filter = None
    if location_state or location_country:
        location_filter = {}
        if location_state:
            location_filter["state"] = location_state
        if location_country:
            location_filter["country"] = location_country

    result = await svc.search_suppliers(
        query=q,
        materials=materials_list,
        certifications=certs_list,
        location=location_filter,
        min_rating=min_rating,
        min_response_rate=min_response_rate,
        max_response_time_hours=max_response_time_hours,
        verified_only=verified_only,
        page=page,
        per_page=per_page,
    )

    return result


@router.get("/search/facets")
async def get_search_facets(
    q: Optional[str] = Query(None, description="Optional keyword to scope facets"),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    Return aggregated facets (categories, certifications, locations, industries).

    Useful for building filter UIs before the user applies specific filters.
    """
    user = get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    svc = _require_search_service()

    # Run a search with no filters — we only care about the aggregations
    result = await svc.search_suppliers(
        query=q,
        page=1,
        per_page=0,  # no hits needed, just facets
    )

    return {
        "facets": result.get("facets", {}),
        "total_suppliers": result.get("total", 0),
    }
