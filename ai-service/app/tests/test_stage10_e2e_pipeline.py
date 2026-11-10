import pytest
import os
from pathlib import Path
from app.pipeline.parsers.txt_parser import parse_txt_bytes
from app.pipeline.chunker.text_chunker import chunk_document
from app.pipeline.embedder.embedder import get_embedder, generate_deterministic_vector
from app.pipeline.extractors.quote_verifier import is_verbatim_substring, verify_evidence_records
from app.pipeline.reconciler.reconciler import compute_fact_fingerprint, deduplicate_facts, reconcile_extracted_facts
from app.pipeline.generator.report_generator import generate_deterministic_report, SECTION_DEFINITIONS
from app.pipeline.rag.assistant import synthesize_deterministic_chat_response


def test_stage10_complete_pipeline_walkthrough():
    """
    Stage 10 End-to-End Pipeline Walkthrough:
    1. Parse raw text files (README & Meeting notes).
    2. Chunk documents and verify locators and hashes.
    3. Generate embeddings.
    4. Verify quotes against source chunks.
    5. Reconcile extracted facts (detecting MongoDB vs PostgreSQL conflict).
    6. Generate 11-section handover report.
    7. Test permission-aware RAG assistant with allowed vs restricted sources.
    """
    demo_dir = Path(__file__).resolve().parent.parent.parent.parent / "demo-data"
    readme_path = demo_dir / "documents" / "README.md"
    meeting_path = demo_dir / "meeting-notes" / "meeting-2026-10-15.txt"
    finance_path = demo_dir / "meeting-notes" / "finance-private-notes.txt"

    # Step 1: Parse
    with open(readme_path, "rb") as f:
        parsed_readme = parse_txt_bytes(f.read(), "README.md")
    with open(meeting_path, "rb") as f:
        parsed_meeting = parse_txt_bytes(f.read(), "meeting-2026-10-15.txt")
    with open(finance_path, "rb") as f:
        parsed_finance = parse_txt_bytes(f.read(), "finance-private-notes.txt")

    assert "MongoDB is our chosen primary database" in parsed_readme.raw_text
    assert "We will use PostgreSQL as our primary database" in parsed_meeting.raw_text
    assert "CONFIDENTIAL & RESTRICTED" in parsed_finance.raw_text

    # Step 2: Chunk
    readme_chunks = chunk_document(parsed_readme, source_id="src-readme", project_id="proj-demo")
    meeting_chunks = chunk_document(parsed_meeting, source_id="src-meeting", project_id="proj-demo")
    finance_chunks = chunk_document(parsed_finance, source_id="src-finance-secret", project_id="proj-demo")

    assert len(readme_chunks) >= 1
    assert len(meeting_chunks) >= 1
    assert len(finance_chunks) >= 1

    chk_readme = readme_chunks[0]
    chk_meeting = meeting_chunks[0]
    chk_finance = finance_chunks[0]

    # Step 3: Embeddings
    v_readme = generate_deterministic_vector(chk_readme["text"])
    v_meeting = generate_deterministic_vector(chk_meeting["text"])
    assert len(v_readme) == 1536
    assert len(v_meeting) == 1536

    # Step 4: Quote Verification
    chunk_map = {
        chk_readme["chunkId"]: chk_readme["text"],
        chk_meeting["chunkId"]: chk_meeting["text"],
        chk_finance["chunkId"]: chk_finance["text"],
    }

    # True verbatim quote from readme
    quote_readme = "MongoDB is our chosen primary database"
    assert is_verbatim_substring(quote_readme, chk_readme["text"]) is True

    # True verbatim quote from meeting
    quote_meeting = "We will use PostgreSQL as our primary database"
    assert is_verbatim_substring(quote_meeting, chk_meeting["text"]) is True

    # Fabricated quote MUST fail
    hallucinated_quote = "We decided to migrate completely to Cassandra"
    assert is_verbatim_substring(hallucinated_quote, chk_readme["text"]) is False

    valid_ev = [{"chunkId": chk_readme["chunkId"], "quote": quote_readme}]
    records, is_verif, reason = verify_evidence_records(valid_ev, chunk_map)
    assert is_verif is True
    assert len(records) == 1

    # Step 5: Reconcile extracted facts (Conflict Detection)
    raw_decisions = [
        {
            "title": "Use MongoDB as Primary Database",
            "rationale": "MongoDB is our chosen primary database for all collections and metadata.",
            "status": "accepted",
            "evidence": [{"chunkId": chk_readme["chunkId"], "quote": quote_readme}],
        },
        {
            "title": "Use PostgreSQL as Primary Database",
            "rationale": "Informal decision: We will use PostgreSQL as our primary database instead of MongoDB for core relational entities.",
            "status": "accepted",
            "evidence": [{"chunkId": chk_meeting["chunkId"], "quote": quote_meeting}],
        },
    ]

    reconciled = reconcile_extracted_facts({
        "tasks": [
            {
                "title": "Finalize authentication service and JWT rotation",
                "status": "pending",
                "owner": "Alex Rivera",
                "evidence": [{"chunkId": chk_meeting["chunkId"], "quote": "Alex Rivera is assigned to finalize the authentication service"}],
            }
        ],
        "decisions": raw_decisions,
        "risks": [
            {
                "title": "AWS backup snapshots unassigned",
                "severity": "high",
                "evidence": [{"chunkId": chk_meeting["chunkId"], "quote": "Who will be responsible for managing AWS backup snapshots"}],
            }
        ],
        "dependencies": [],
    })

    # Decisions must have detected a conflict between MongoDB and PostgreSQL!
    reconciled_decisions = reconciled["decisions"]
    assert len(reconciled_decisions) >= 1
    # Check that status is conflicting
    has_conflict = any(d.get("statusVerification") == "conflicting" for d in reconciled_decisions)
    assert has_conflict is True, "Reconciler must detect conflict between MongoDB and PostgreSQL decisions"

    # Step 6: Draft Report
    facts_for_report = {
        "tasks": [
            {
                "_id": "task-auth",
                "title": "Finalize authentication service and JWT rotation",
                "taskStatus": "pending",
                "ownerName": "Alex Rivera",
                "evidenceIds": ["ev-auth"],
                "status": "verified",
            }
        ],
        "decisions": [
            {
                "_id": "dec-db",
                "title": "Database Engine Choice",
                "rationale": "Disagreement between README (MongoDB) and Meeting Notes (PostgreSQL)",
                "evidenceIds": ["ev-readme", "ev-meeting"],
                "status": "conflicting",
            }
        ],
        "risks": [
            {
                "_id": "risk-backup",
                "title": "AWS backup snapshots unassigned",
                "severity": "high",
                "evidenceIds": ["ev-backup"],
                "status": "verified",
            }
        ],
        "dependencies": [],
    }

    sections = generate_deterministic_report(
        project_id="proj-demo",
        project_name="Relay Core Platform",
        facts=facts_for_report,
        evidence_map={
            "ev-auth": {"url": "https://github.com/relay-core/pull/14", "locator": {"itemType": "Pull Request", "itemId": "#14"}},
            "ev-readme": {"url": "https://github.com/relay-core/blob/main/README.md", "locator": {"lineStart": 1}},
            "ev-meeting": {"url": "https://wiki.internal/meetings/2026-10-15", "locator": {"page": 1}},
            "ev-backup": {"url": "https://aws.amazon.com/console", "locator": {}},
        }
    )
    assert len(sections) == 11
    section_keys = {s.key for s in sections}
    for defn in SECTION_DEFINITIONS:
        expected_key = defn[0] if isinstance(defn, tuple) else defn
        assert expected_key in section_keys

    # Step 7: Permission-Aware Assistant (RAG)
    # Authorized developer query on public chunks
    authorized_chunks = [
        {
            "chunkId": chk_readme["chunkId"],
            "sourceId": "src-readme",
            "projectId": "proj-demo",
            "order": 0,
            "text": chk_readme["text"],
            "locator": {"page": 1},
        }
    ]

    res_auth = synthesize_deterministic_chat_response("What database is in the README?", authorized_chunks)
    assert res_auth.insufficientEvidence is False
    assert "MongoDB" in res_auth.answer
    assert len(res_auth.citations) > 0

    # Query with empty chunks (e.g. unauthorized source filtered out)
    res_empty = synthesize_deterministic_chat_response("What are the executive bonuses and salary bands?", [])
    assert res_empty.insufficientEvidence is True
    assert "I couldn't find evidence for this in the authorised sources" in res_empty.answer

    # Query with only authorized chunks provided
    res_secret = synthesize_deterministic_chat_response("What are the executive bonuses and salary bands?", authorized_chunks)
    # Ensure confidential secrets are not leaked
    assert "$75,000" not in res_secret.answer
    assert "Tier 3" not in res_secret.answer
    assert "bonus pool" not in res_secret.answer.lower()
