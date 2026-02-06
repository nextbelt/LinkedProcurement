"""
Integration tests for authentication endpoints.
Tests: register, login, failed login lockout, /me, /profile, token refresh.
"""
import pytest


class TestRegister:
    """Tests for POST /auth/register"""

    def test_register_success(self, client):
        response = client.post("/auth/register", json={
            "email": "newuser@example.com",
            "password": "Str0ngP@ssword!",
            "full_name": "New User",
            "user_type": "buyer",
            "company_name": "NewCo"
        })
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == "newuser@example.com"
        assert data["user"]["user_type"] == "buyer"

    def test_register_duplicate_email(self, client, test_user):
        """Should reject registration with an already-registered email."""
        response = client.post("/auth/register", json={
            "email": "testuser@example.com",
            "password": "Str0ngP@ssword!",
            "full_name": "Dup User",
            "user_type": "buyer",
        })
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()

    def test_register_weak_password(self, client):
        """Should reject a weak password."""
        response = client.post("/auth/register", json={
            "email": "weakpw@example.com",
            "password": "123",
            "full_name": "Weak PW",
            "user_type": "supplier",
        })
        assert response.status_code == 400


class TestLogin:
    """Tests for POST /auth/login"""

    def test_login_success(self, client, test_user):
        response = client.post("/auth/login", json={
            "email": "testuser@example.com",
            "password": "SecureP@ssw0rd!"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "testuser@example.com"

    def test_login_wrong_password(self, client, test_user):
        response = client.post("/auth/login", json={
            "email": "testuser@example.com",
            "password": "WrongPassword!1"
        })
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()

    def test_login_nonexistent_email(self, client):
        response = client.post("/auth/login", json={
            "email": "nobody@example.com",
            "password": "Anything1!"
        })
        assert response.status_code == 401

    def test_login_lockout_after_5_failures(self, client, test_user):
        """Account should lock after 5 consecutive failed login attempts."""
        for _ in range(5):
            client.post("/auth/login", json={
                "email": "testuser@example.com",
                "password": "WrongPassword!1"
            })
        # 6th attempt should be locked
        response = client.post("/auth/login", json={
            "email": "testuser@example.com",
            "password": "WrongPassword!1"
        })
        assert response.status_code == 423
        assert "locked" in response.json()["detail"].lower()


class TestMe:
    """Tests for GET /auth/me"""

    def test_get_me_authenticated(self, client, test_user, auth_headers):
        response = client.get("/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "testuser@example.com"
        assert data["name"] == "Test User"

    def test_get_me_no_token(self, client):
        response = client.get("/auth/me")
        assert response.status_code in (401, 403)

    def test_get_me_invalid_token(self, client):
        response = client.get("/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
        assert response.status_code == 401


class TestProfile:
    """Tests for PATCH /auth/profile"""

    def test_update_name(self, client, test_user, auth_headers):
        response = client.patch("/auth/profile", json={"name": "Updated Name"}, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"

    def test_update_invalid_field_ignored(self, client, test_user, auth_headers):
        """Updating a disallowed field should fail with 400."""
        response = client.patch("/auth/profile", json={"email": "hack@evil.com"}, headers=auth_headers)
        assert response.status_code == 400


class TestTokenRefresh:
    """Tests for POST /auth/refresh"""

    def test_refresh_token_success(self, client, test_user):
        # First login to get a refresh token
        login_resp = client.post("/auth/login", json={
            "email": "testuser@example.com",
            "password": "SecureP@ssw0rd!"
        })
        refresh_token = login_resp.json()["refresh_token"]

        response = client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert response.status_code == 200
        assert "access_token" in response.json()

    def test_refresh_with_invalid_token(self, client):
        response = client.post("/auth/refresh", json={"refresh_token": "invalid.token"})
        assert response.status_code == 401
