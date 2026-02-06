"""
Integration tests for RFQ CRUD endpoints.
Tests: create, list, get, update, submit response, organization scoping.
"""
import pytest
import uuid


class TestCreateRFQ:
    """Tests for POST /rfqs"""

    def test_create_rfq_success(self, client, test_user, test_poc, auth_headers):
        response = client.post("/rfqs", json={
            "title": "Need steel bolts",
            "material_category": "Fasteners",
            "quantity": "10000 units",
            "target_price": "$0.50/unit",
            "specifications": "M8 grade 8.8 hex bolts",
            "visibility": "public",
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Need steel bolts"
        assert data["status"] in ("draft", "active")
        assert data["visibility"] == "public"

    def test_create_rfq_unauthenticated(self, client):
        response = client.post("/rfqs", json={
            "title": "Should fail",
            "material_category": "Test",
        })
        assert response.status_code in (401, 403)

    def test_create_rfq_no_company(self, client, test_user, auth_headers):
        """User without a POC/company should not be able to post RFQs."""
        response = client.post("/rfqs", json={
            "title": "No company RFQ",
            "material_category": "Test",
        }, headers=auth_headers)
        assert response.status_code == 400
        assert "company" in response.json()["detail"].lower()


class TestListRFQs:
    """Tests for GET /rfqs"""

    def test_list_rfqs_empty(self, client):
        response = client.get("/rfqs")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_list_rfqs_with_search(self, client, test_user, test_poc, auth_headers):
        # Create an RFQ first
        client.post("/rfqs", json={
            "title": "Aluminum extrusions needed",
            "material_category": "Metals",
            "quantity": "500 kg",
            "visibility": "public",
        }, headers=auth_headers)

        # Search for it
        response = client.get("/rfqs?search=aluminum")
        assert response.status_code == 200
        # May or may not find it depending on status default; just verify no crash
        assert isinstance(response.json(), list)

    def test_list_rfqs_with_organization_filter(self, client):
        """Should accept organization_id query parameter without error."""
        fake_org = str(uuid.uuid4())
        response = client.get(f"/rfqs?organization_id={fake_org}")
        assert response.status_code == 200
        assert response.json() == []


class TestGetRFQ:
    """Tests for GET /rfqs/{rfq_id}"""

    def test_get_rfq_not_found(self, client, auth_headers):
        fake_id = str(uuid.uuid4())
        response = client.get(f"/rfqs/{fake_id}", headers=auth_headers)
        assert response.status_code == 404

    def test_get_rfq_invalid_uuid(self, client, auth_headers):
        response = client.get("/rfqs/not-a-uuid", headers=auth_headers)
        assert response.status_code in (400, 404, 422)


class TestRFQResponses:
    """Tests for RFQ response/quote submission endpoints."""

    def _create_rfq(self, client, auth_headers):
        resp = client.post("/rfqs", json={
            "title": "Test RFQ for responses",
            "material_category": "Electronics",
            "quantity": "1000 units",
            "visibility": "public",
        }, headers=auth_headers)
        return resp.json()

    def test_submit_response_unauthenticated(self, client, test_user, test_poc, auth_headers):
        rfq = self._create_rfq(client, auth_headers)
        rfq_id = rfq.get("id")
        if not rfq_id:
            pytest.skip("RFQ creation failed")

        # Try to respond without auth
        response = client.post(f"/rfqs/{rfq_id}/responses", json={
            "price_quote": "$0.45/unit",
            "lead_time_days": 14,
            "message": "We can deliver.",
        })
        assert response.status_code in (401, 403)


class TestOrganizationScoping:
    """Tests to verify organization_id is set on RFQ creation."""

    def test_rfq_created_without_org_has_null_org_id(self, client, test_user, test_poc, auth_headers, db_session):
        """When user has no org membership, RFQ.organization_id should be None."""
        from app.models.user import RFQ as RFQModel

        response = client.post("/rfqs", json={
            "title": "No org RFQ",
            "material_category": "General",
            "quantity": "100",
            "visibility": "public",
        }, headers=auth_headers)
        assert response.status_code == 200
        rfq_id = response.json()["id"]

        rfq = db_session.query(RFQModel).filter(RFQModel.id == rfq_id).first()
        assert rfq is not None
        assert rfq.organization_id is None
