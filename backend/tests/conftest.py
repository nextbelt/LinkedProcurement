import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
import os
import uuid

# Set test environment variables before importing app
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["SUPABASE_URL"] = "https://test.supabase.co"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "test-key"
os.environ["SUPABASE_ANON_KEY"] = "test-anon-key"
os.environ["SECRET_KEY"] = "test-secret-key-for-unit-tests-only-32chars!"
os.environ["ENVIRONMENT"] = "test"
os.environ["STRIPE_SECRET_KEY"] = ""
os.environ["STRIPE_WEBHOOK_SECRET"] = ""

from app.core.database import Base, get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.models.user import User, Company, POC, RFQ


SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

# Enable foreign keys for SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with overridden database dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db_session):
    """Create a test user and return (user, access_token)."""
    user = User(
        id=uuid.uuid4(),
        email="testuser@example.com",
        name="Test User",
        hashed_password=get_password_hash("SecureP@ssw0rd!"),
        is_active=True,
        is_verified=True,
        verification_status="verified",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(subject=str(user.id))
    return user, token


@pytest.fixture
def test_company(db_session):
    """Create a test company."""
    company = Company(
        id=uuid.uuid4(),
        name="Acme Corp",
        industry="Manufacturing",
        is_verified=True,
        verification_source="manual",
    )
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)
    return company


@pytest.fixture
def test_poc(db_session, test_user, test_company):
    """Create a POC linking test_user to test_company as buyer."""
    user, _ = test_user
    poc = POC(
        id=uuid.uuid4(),
        user_id=user.id,
        company_id=test_company.id,
        role="Procurement Officer",
        is_primary=True,
        availability_status="available",
    )
    db_session.add(poc)
    db_session.commit()
    db_session.refresh(poc)
    return poc


@pytest.fixture
def auth_headers(test_user):
    """Return Authorization headers with a valid JWT."""
    _, token = test_user
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def mock_supabase():
    """Mock Supabase client for tests."""
    mock = MagicMock()
    mock.auth.get_user.return_value = MagicMock(
        user=MagicMock(id="test-user-id", email="test@example.com")
    )
    return mock
