import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)


def test_public_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["data"]["status"] == "ok"


def test_internal_health_authorized():
    response = client.get(
        "/internal/health",
        headers={"X-Internal-Key": settings.INTERNAL_SERVICE_KEY}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["data"]["status"] == "healthy"


def test_internal_health_unauthorized_missing_key():
    response = client.get("/internal/health")
    assert response.status_code == 422 or response.status_code == 401


def test_internal_health_unauthorized_wrong_key():
    response = client.get(
        "/internal/health",
        headers={"X-Internal-Key": "wrong-secret-key-12345"}
    )
    assert response.status_code == 401
    data = response.json()
    assert data["detail"]["ok"] is False
    assert data["detail"]["error"]["code"] == "UNAUTHORIZED"
