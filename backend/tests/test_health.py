def test_health_check(client):
    """Test that the health check endpoint returns 200."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "ok"]


def test_api_docs_accessible(client):
    """Test that API docs are accessible."""
    response = client.get("/docs")
    assert response.status_code == 200
