import os
import pytest
from app.pipeline.parsers.github_parser import parse_github_items, GithubItemInput
from app.pipeline.chunker.text_chunker import chunk_document
from app.pipeline.embedder.embedder import get_embedder
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
INTERNAL_KEY = "dev-internal-service-key-secret-12345"


def test_parse_github_items():
    items = [
        GithubItemInput(
            itemType="readme",
            itemId="README.md",
            title="README (codesync/relay)",
            url="https://github.com/codesync/relay/blob/main/README.md",
            text="# Relay Core\nPrimary Database: MongoDB."
        ),
        GithubItemInput(
            itemType="pull_request",
            itemId="#12",
            title="PR #12: feat: migrate database to PostgreSQL",
            url="https://github.com/codesync/relay/pull/12",
            text="Migrating from MongoDB to PostgreSQL as agreed in architecture sync."
        ),
        GithubItemInput(
            itemType="commit",
            itemId="a1b2c3d",
            title="Commit a1b2c3d: initial server setup",
            url="https://github.com/codesync/relay/commit/a1b2c3d",
            text="Commit [a1b2c3d]: initial server setup\nAuthor: Sarah Chen"
        ),
        GithubItemInput(
            itemType="issue",
            itemId="#8",
            title="Issue #8: Database engine decision",
            url="https://github.com/codesync/relay/issues/8",
            text="Issue #8 [open]: Contradiction between MongoDB README and PostgreSQL PR #12."
        )
    ]

    parsed = parse_github_items(items, repo_name="codesync/relay")
    assert parsed.metadata["sourceType"] == "github"
    assert parsed.metadata["totalItems"] == 4
    assert len(parsed.locators) == 4
    assert parsed.locators[1].itemType == "pull_request"
    assert parsed.locators[1].itemId == "#12"
    assert parsed.locators[1].url == "https://github.com/codesync/relay/pull/12"


def test_chunking_preserves_github_locators():
    items = [
        GithubItemInput(
            itemType="pull_request",
            itemId="#12",
            title="PR #12: PostgreSQL migration",
            url="https://github.com/codesync/relay/pull/12",
            text="Short PR description for PostgreSQL migration."
        ),
        GithubItemInput(
            itemType="commit",
            itemId="e4f5a6b",
            title="Commit e4f5a6b: auth implementation",
            url="https://github.com/codesync/relay/commit/e4f5a6b",
            text="Commit [e4f5a6b]: Added JWT auth."
        )
    ]

    parsed = parse_github_items(items, repo_name="codesync/relay")
    chunks = chunk_document(parsed, source_id="src-gh-1", project_id="proj-1")

    assert len(chunks) == 2
    pr_chunk = chunks[0]
    assert pr_chunk["locator"]["itemType"] == "pull_request"
    assert pr_chunk["locator"]["itemId"] == "#12"
    assert pr_chunk["locator"]["url"] == "https://github.com/codesync/relay/pull/12"
    assert "PostgreSQL" in pr_chunk["text"]

    commit_chunk = chunks[1]
    assert commit_chunk["locator"]["itemType"] == "commit"
    assert commit_chunk["locator"]["itemId"] == "e4f5a6b"
    assert commit_chunk["locator"]["url"] == "https://github.com/codesync/relay/commit/e4f5a6b"


def test_internal_ingest_github_endpoint():
    payload = {
        "sourceId": "gh-src-test-01",
        "projectId": "proj-test-01",
        "type": "github",
        "title": "codesync-team/relay-core",
        "items": [
            {
                "itemType": "readme",
                "itemId": "README.md",
                "title": "README",
                "url": "https://github.com/codesync-team/relay-core/blob/main/README.md",
                "text": "MongoDB is our chosen database."
            },
            {
                "itemType": "pull_request",
                "itemId": "#12",
                "title": "PR #12: PostgreSQL migration",
                "url": "https://github.com/codesync-team/relay-core/pull/12",
                "text": "Migrate to PostgreSQL."
            }
        ]
    }

    res = client.post(
        "/internal/sources/ingest",
        json=payload,
        headers={"X-Internal-Key": INTERNAL_KEY}
    )

    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["data"]["accepted"] is True

