from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import time
import logging
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import create_tables
from app.core.sentry_config import init_sentry
from app.api import auth, rfq, mfa, billing
from app.api import health, data_management
from app.api import organizations, rfq_extended, notifications
from app.api import ai_assist
from app.api import supplier_search
from app.services.linkedin import linkedin_service
from app.middleware.security_headers import SecurityHeadersMiddleware

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

# Simple rate limiting (can be enhanced with Redis later)
request_counts = {}


def simple_rate_limit(request: Request, max_requests: int = 60):
    """Simple in-memory rate limiting"""
    client_ip = request.client.host
    current_time = time.time()
    
    # Clean old entries (older than 1 minute)
    if client_ip in request_counts:
        request_counts[client_ip] = [
            timestamp for timestamp in request_counts[client_ip] 
            if current_time - timestamp < 60
        ]
    else:
        request_counts[client_ip] = []
    
    # Check if under limit
    if len(request_counts[client_ip]) >= max_requests:
        return False
    
    request_counts[client_ip].append(current_time)
    return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan events
    """
    # Startup
    logger.info("Starting LinkedProcurement API")
    
    # Initialize Sentry for error tracking
    try:
        init_sentry()
    except Exception as e:
        logger.warning(f"Sentry initialization failed: {e}")
    
    # Create database tables (skip if using Supabase - tables already exist)
    try:
        create_tables()
        logger.info("Database tables created/verified")
    except Exception as e:
        logger.warning(f"Database table creation skipped (using Supabase): {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down LinkedProcurement API")


# Create FastAPI app
app = FastAPI(
    title=settings.project_name,
    version=settings.version,
    description="A comprehensive B2B supply chain sourcing platform with LinkedIn API integration and email/password authentication",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan
)

# =============================================================================
# MIDDLEWARE - ORDER MATTERS! CORS must be first
# =============================================================================

# Healthcheck endpoint BEFORE middleware - Railway needs this
@app.get("/healthz", include_in_schema=False)
async def healthz():
    """Simple health check for Railway - no middleware"""
    return {"status": "ok"}

# Build CORS origins list
cors_origins = [
    # Local development
    "http://localhost:2000",
    "http://127.0.0.1:2000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:7000",
    "http://127.0.0.1:7000",
    # Railway Production
    "https://loyal-inspiration-production.up.railway.app",
    "https://sscnet-production.up.railway.app",
    # Production Domain
    "https://linkedprocurement.com",
    "https://www.linkedprocurement.com",
    "https://api.linkedprocurement.com",
    "https://app.linkedprocurement.com",
]
# Add any additional origins from settings
if settings.allowed_origins:
    cors_origins.extend(settings.allowed_origins)

# 1. CORS middleware - MUST BE FIRST
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600
)

# 2. Security headers (SOC 2 Compliance)
app.add_middleware(SecurityHeadersMiddleware)

# 3. Rate limiting middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if not simple_rate_limit(request):
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests"}
        )
    response = await call_next(request)
    return response

# Trusted host middleware (security)
if not settings.debug:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=[
            "*.sscn.com", 
            "sscn.com", 
            "localhost",
            "*.railway.app",
            "*.up.railway.app"
        ]
    )


# Exception handlers
@app.exception_handler(404)
async def not_found_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=404,
        content={"detail": "Endpoint not found"}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc) if settings.debug else None}
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc: Exception):
    logger.error(f"Internal server error: {exc}", exc_info=True)
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc) if settings.debug else None}
    )


# Middleware for request timing
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Health check endpoint
@app.get("/health")
async def health_check(request: Request):
    """
    Health check endpoint for load balancers and monitoring
    """
    return {
        "status": "healthy",
        "version": settings.version,
        "environment": settings.environment,
        "timestamp": time.time(),
        "cors_test": "If you see this, CORS is working"
    }


# CORS test endpoint
@app.get("/cors-test")
async def cors_test(request: Request):
    """Test endpoint to verify CORS is working"""
    return {
        "message": "CORS is working!",
        "origin": request.headers.get("origin", "no-origin"),
        "headers": dict(request.headers)
    }


@app.post("/cors-test")
async def cors_test_post(request: Request):
    """Test POST endpoint to verify CORS is working"""
    return {
        "message": "POST CORS is working!",
        "origin": request.headers.get("origin", "no-origin")
    }


# API status endpoint
@app.get("/")
async def root(request: Request):
    """
    API root endpoint with basic information
    """
    return {
        "message": "LinkedProcurement API",
        "version": settings.version,
        "environment": settings.environment,
        "docs_url": "/docs" if settings.debug else "Contact admin for API documentation",
        "linkedin_auth_url": "/api/auth/linkedin"
    }


# Global OPTIONS handler for all routes - DISABLED, let CORS middleware handle it
# @app.options("/{path:path}")
# async def options_handler(request: Request):
#     """Handle OPTIONS requests for CORS preflight"""
#     origin = request.headers.get("origin", "*")
#     return JSONResponse(
#         content={},
#         status_code=200,
#         headers={
#             "Access-Control-Allow-Origin": origin,
#             "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
#             "Access-Control-Allow-Headers": "*",
#             "Access-Control-Allow-Credentials": "true",
#             "Access-Control-Max-Age": "600",
#             "Content-Length": "0",
#         }
#     )


# Include API routers
app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(mfa.router, prefix="/api/v1")
app.include_router(rfq.router, prefix="/api/v1")
app.include_router(data_management.router, prefix="/api/v1")
app.include_router(billing.router)
app.include_router(organizations.router, prefix="/api/v1/organizations", tags=["organizations"])
app.include_router(rfq_extended.router, prefix="/api/v1", tags=["rfq-extended"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(ai_assist.router)
app.include_router(supplier_search.router, tags=["supplier-search"])


# Additional API routes would be included here:
# app.include_router(companies.router, prefix="/api/v1")
# app.include_router(search.router, prefix="/api/v1")
# app.include_router(messages.router, prefix="/api/v1")
# app.include_router(analytics.router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=7000,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )