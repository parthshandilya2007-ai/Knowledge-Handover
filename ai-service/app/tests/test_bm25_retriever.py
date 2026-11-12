import pytest
from app.pipeline.rag.bm25 import BM25Index, tokenize
from app.pipeline.rag.retriever import retrieve_authorized_chunks


def test_tokenize():
    text = "Deploying MongoDB Atlas M0 with JWT authentication & zero cost!"
    tokens = tokenize(text)
    assert "deploying" in tokens
    assert "mongodb" in tokens
    assert "jwt" in tokens
    assert "zero" in tokens


def test_bm25_scoring():
    chunks = [
        {
            "chunkId": "c1",
            "sourceId": "s1",
            "text": "The team decided to use PostgreSQL for relational transactions.",
            "locator": {"lineStart": 1, "lineEnd": 2}
        },
        {
            "chunkId": "c2",
            "sourceId": "s1",
            "text": "MongoDB Atlas is used for storing document chunks, facts, and audit logs.",
            "locator": {"lineStart": 3, "lineEnd": 4}
        },
        {
            "chunkId": "c3",
            "sourceId": "s2",
            "text": "Alex Rivera is responsible for the authentication service and JWT token rotation.",
            "locator": {"lineStart": 1, "lineEnd": 3}
        }
    ]

    index = BM25Index(chunks)

    # Search for mongodb
    results = index.search("MongoDB Atlas database", top_k=2)
    assert len(results) > 0
    top_score, top_chunk = results[0]
    assert top_chunk["chunkId"] == "c2"
    assert "MongoDB" in top_chunk["text"]

    # Search for authentication owner
    results_auth = index.search("Who handles authentication and JWT?", top_k=2)
    assert len(results_auth) > 0
    top_score_auth, top_chunk_auth = results_auth[0]
    assert top_chunk_auth["chunkId"] == "c3"
    assert "Alex Rivera" in top_chunk_auth["text"]


@pytest.mark.anyio
async def test_retrieve_authorized_chunks_filters_restricted_sources():
    # Calling retrieve with empty allowed_source_ids must return empty list
    res = await retrieve_authorized_chunks("p1", "some query", allowed_source_ids=[])
    assert res == []
