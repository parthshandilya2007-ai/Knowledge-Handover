import pytest
from app.pipeline.extractors.quote_verifier import is_verbatim_substring, verify_evidence_records, normalize_whitespace
from app.pipeline.reconciler.reconciler import compute_fact_fingerprint, deduplicate_facts, reconcile_extracted_facts
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
INTERNAL_KEY = "dev-internal-service-key-secret-12345"


def test_quote_verification_verbatim_and_whitespace():
    source_text = """
    Architecture Overview:
    We have selected MongoDB Atlas as our core database for all collections.
    The backend runs on Node.js with Express.
    """

    # 1. Exact match with whitespace differences
    quote1 = "MongoDB Atlas as our core database for all collections."
    assert is_verbatim_substring(quote1, source_text) is True

    # 2. Quote with multiple newlines and spaces
    quote2 = "selected   MongoDB\nAtlas   as our core database"
    assert is_verbatim_substring(quote2, source_text) is True

    # 3. Fabricated quote (hallucinated / altered wording) MUST BE REJECTED
    fabricated_quote = "We decided to deploy MongoDB Atlas in production."
    assert is_verbatim_substring(fabricated_quote, source_text) is False

    # 4. Partial mismatch
    mismatch_quote = "PostgreSQL is our core database"
    assert is_verbatim_substring(mismatch_quote, source_text) is False


def test_verify_evidence_records_drops_fabricated_quotes():
    chunk_map = {
        "chunk-101": "Primary Database: MongoDB is our chosen primary database for all collections and metadata."
    }

    # Valid evidence record
    valid_ev = [{"chunkId": "chunk-101", "quote": "MongoDB is our chosen primary database"}]
    records, is_verif, reason = verify_evidence_records(valid_ev, chunk_map)
    assert len(records) == 1
    assert is_verif is True
    assert reason is None

    # Fabricated evidence record
    fabricated_ev = [{"chunkId": "chunk-101", "quote": "PostgreSQL was unanimously selected by the team"}]
    records, is_verif, reason = verify_evidence_records(fabricated_ev, chunk_map)
    assert len(records) == 0
    assert is_verif is False
    assert "verification" in reason.lower()


def test_reconciler_deduplication():
    tasks = [
        {
            "title": "Migrate database to PostgreSQL",
            "description": "Short desc",
            "status": "pending",
            "evidence": [{"chunkId": "c1", "quote": "q1"}]
        },
        {
            "title": "Migrate database to PostgreSQL",
            "description": "Longer and more detailed description",
            "status": "pending",
            "owner": "Marcus",
            "evidence": [{"chunkId": "c2", "quote": "q2"}]
        }
    ]

    deduped = deduplicate_facts(tasks, "task")
    assert len(deduped) == 1
    assert len(deduped[0]["evidence"]) == 2
    assert deduped[0]["owner"] == "Marcus"
    assert "detailed" in deduped[0]["description"]


def test_reconciler_detects_mongodb_vs_postgresql_conflict():
    raw_facts = {
        "tasks": [],
        "decisions": [
            {
                "title": "Use MongoDB as Primary Database",
                "rationale": "MongoDB is our chosen primary database for all collections and metadata.",
                "status": "accepted",
                "evidence": [{"chunkId": "chunk-readme", "quote": "MongoDB is our chosen primary database"}]
            },
            {
                "title": "Use PostgreSQL as Primary Database",
                "rationale": "Informal decision: We will use PostgreSQL as our primary database instead of MongoDB.",
                "status": "accepted",
                "evidence": [{"chunkId": "chunk-meeting", "quote": "We will use PostgreSQL as our primary database"}]
            }
        ],
        "risks": [],
        "dependencies": []
    }

    reconciled = reconcile_extracted_facts(raw_facts)
    decisions = reconciled["decisions"]
    assert len(decisions) == 2

    # Both must be flagged conflicting with cross-references
    assert decisions[0]["statusVerification"] == "conflicting"
    assert decisions[1]["statusVerification"] == "conflicting"
    assert decisions[0]["conflictDetails"]["conflictingWith"] == [decisions[1]["fingerprint"]]
    assert decisions[1]["conflictDetails"]["conflictingWith"] == [decisions[0]["fingerprint"]]


def test_pipeline_run_internal_endpoint():
    res = client.post(
        "/internal/pipeline/run",
        json={"jobId": "test-job-456", "projectId": "test-proj-789"},
        headers={"X-Internal-Key": INTERNAL_KEY}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["data"]["accepted"] is True

