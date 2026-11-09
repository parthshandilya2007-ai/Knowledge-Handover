import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.pipeline.rag.assistant import (
    synthesize_deterministic_chat_response,
    answer_project_question,
)
from app.pipeline.embedder.embedder import generate_deterministic_vector

client = TestClient(app)

MOCK_CHUNKS = [
    {
        "chunkId": "chk-rag-1",
        "sourceId": "src-public-1",
        "projectId": "proj-rag-101",
        "order": 0,
        "text": "The primary database architecture is PostgreSQL deployed on AWS RDS with automated backups.",
        "embedding": generate_deterministic_vector("The primary database architecture is PostgreSQL"),
        "locator": {"page": 1, "lineStart": 1, "lineEnd": 5},
    },
    {
        "chunkId": "chk-rag-secret",
        "sourceId": "src-secret-1",
        "projectId": "proj-rag-101",
        "order": 0,
        "text": "Confidential executive bonuses and budget allocations for Q4 2026 are restricted.",
        "embedding": generate_deterministic_vector("Confidential executive bonuses"),
        "locator": {"page": 1},
    },
]


def mock_get_chunks(project_id: str, source_ids=None):
    return [
        c
        for c in MOCK_CHUNKS
        if c.get("projectId") == project_id
        and (source_ids is None or c.get("sourceId") in source_ids)
    ]


def test_rag_with_insufficient_evidence_when_unauthorized():
    response = synthesize_deterministic_chat_response("What is the Q4 budget allocation?", [])
    assert response.insufficientEvidence is True
    assert "I couldn't find evidence for this in the authorised sources" in response.answer
    assert len(response.citations) == 0


def test_rag_with_authorized_chunks_answers_with_citations():
    chunks = [MOCK_CHUNKS[0]]
    response = synthesize_deterministic_chat_response("What is the primary database?", chunks)
    assert response.insufficientEvidence is False
    assert "PostgreSQL" in response.answer
    assert len(response.citations) > 0
    assert response.citations[0].chunkId == "chk-rag-1"
    assert len(response.suggestedActions) > 0


def test_permission_prefiltering_prevents_secret_leak():
    import asyncio
    with patch("app.pipeline.rag.retriever.get_chunks_by_project", side_effect=mock_get_chunks):
        # User only has access to src-public-1, NOT src-secret-1
        result = asyncio.run(
            answer_project_question(
                project_id="proj-rag-101",
                question="What are the confidential executive bonuses?",
                allowed_source_ids=["src-public-1"],  # Secret source is omitted!
            )
        )

        # Must NOT leak secret information
        assert "Confidential executive bonuses" not in result.answer
        assert result.insufficientEvidence is True


def test_internal_chat_endpoint_success():
    with patch("app.pipeline.rag.retriever.get_chunks_by_project", side_effect=mock_get_chunks):
        res = client.post(
            "/internal/chat",
            json={
                "projectId": "proj-rag-101",
                "question": "What database do we use?",
                "allowedSourceIds": ["src-public-1"],
            },
            headers={"X-Internal-Key": settings.INTERNAL_SERVICE_KEY},
        )

        assert res.status_code == 200
        data = res.json()
        assert data["ok"] is True
        chat_data = data["data"]
        assert "PostgreSQL" in chat_data["answer"]
        assert len(chat_data["citations"]) > 0
        assert chat_data["citations"][0]["chunkId"] == "chk-rag-1"
