import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.pipeline.generator.report_generator import (
    generate_deterministic_report,
    SECTION_DEFINITIONS,
)

client = TestClient(app)

MOCK_FACTS = {
    "tasks": [
        {
            "_id": "task-1",
            "title": "Merge PR #14 WebSockets",
            "taskStatus": "completed",
            "evidenceIds": ["ev-1"],
            "status": "verified",
        },
        {
            "_id": "task-2",
            "title": "Migrate database to PostgreSQL",
            "taskStatus": "pending",
            "ownerName": "Alex Chen",
            "dueDate": "2026-11-20",
            "evidenceIds": ["ev-2"],
            "status": "conflicting",
        },
    ],
    "decisions": [
        {
            "_id": "dec-1",
            "title": "Database Engine Choice",
            "rationale": "Team decided on PostgreSQL for relational consistency",
            "decidedBy": "Alex Chen",
            "evidenceIds": ["ev-2"],
            "status": "conflicting",
        }
    ],
    "risks": [
        {
            "_id": "risk-1",
            "title": "PostgreSQL Migration Downtime",
            "kind": "risk",
            "severity": "high",
            "description": "Migration requires 2h maintenance window",
            "evidenceIds": ["ev-2"],
            "status": "verified",
        },
        {
            "_id": "risk-2",
            "title": "Missing Stripe Webhook Secrets in Staging",
            "kind": "open_question",
            "severity": "medium",
            "description": "Who holds the staging webhook signing secret?",
            "evidenceIds": ["ev-3"],
            "status": "uncertain",
        },
    ],
    "dependencies": [
        {
            "_id": "dep-1",
            "fromRef": "Backend Auth Service",
            "toRef": "PostgreSQL Database",
            "dependencyType": "service",
            "note": "Requires pg_trgm extension",
            "evidenceIds": ["ev-2"],
        }
    ],
}

MOCK_EVIDENCE_MAP = {
    "ev-1": {
        "quote": "PR #14 WebSockets merge completed.",
        "sourceTitle": "github-fixture.json",
        "url": "https://github.com/org/repo/pull/14",
    },
    "ev-2": {
        "quote": "We will use PostgreSQL instead of MongoDB.",
        "sourceTitle": "meeting-notes.txt",
        "url": "https://github.com/org/repo/pull/12",
    },
    "ev-3": {
        "quote": "Need to confirm Stripe staging secret before launch.",
        "sourceTitle": "architecture-notes.txt",
    },
}


def test_deterministic_generator_has_11_sections():
    sections = generate_deterministic_report(
        project_id="proj-123",
        project_name="Hackathon Demo Project",
        facts=MOCK_FACTS,
        evidence_map=MOCK_EVIDENCE_MAP,
    )

    assert len(sections) == 11
    section_keys = [s.key for s in sections]
    expected_keys = [k for k, _ in SECTION_DEFINITIONS]
    assert section_keys == expected_keys


def test_first_week_plan_is_grounded_and_has_five_days():
    sections = generate_deterministic_report(
        project_id="proj-123",
        project_name="Hackathon Demo Project",
        facts=MOCK_FACTS,
        evidence_map=MOCK_EVIDENCE_MAP,
    )

    plan_section = next(s for s in sections if s.key == "first_week_plan")
    assert len(plan_section.items) == 5

    # Check Day 1 to Day 5 labels
    days = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"]
    for i, day in enumerate(days):
        assert day in plan_section.items[i].text
        # Every day should have citations or flagged appropriately
        assert len(plan_section.items[i].citations) > 0 or plan_section.items[i].flag == "no_evidence"


def test_conflict_flag_propagated_to_report_items():
    sections = generate_deterministic_report(
        project_id="proj-123",
        project_name="Hackathon Demo Project",
        facts=MOCK_FACTS,
        evidence_map=MOCK_EVIDENCE_MAP,
    )

    decisions_section = next(s for s in sections if s.key == "decisions")
    assert any(item.flag == "conflict" for item in decisions_section.items)


def test_endpoint_internal_generate():
    response = client.post(
        "/internal/generate",
        json={
            "projectId": "proj-999",
            "projectName": "Test API Project",
            "facts": MOCK_FACTS,
            "evidenceMap": MOCK_EVIDENCE_MAP,
        },
        headers={"X-Internal-Key": settings.INTERNAL_SERVICE_KEY},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    sections = data["data"]["sections"]
    assert len(sections) == 11
    assert any(s["key"] == "first_week_plan" for s in sections)

