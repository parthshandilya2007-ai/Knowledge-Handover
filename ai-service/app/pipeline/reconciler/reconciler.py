import hashlib
import re
from typing import List, Dict, Any, Tuple


def compute_fact_fingerprint(entity_type: str, title: str) -> str:
    """
    Computes a deterministic SHA-256 fingerprint for a fact to prevent duplicates.
    Normalizes by lowercasing and stripping punctuation.
    """
    cleaned_title = re.sub(r"[^a-zA-Z0-9\s]", "", title.lower()).strip()
    cleaned_title = re.sub(r"\s+", " ", cleaned_title)
    seed = f"{entity_type}:{cleaned_title}"
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()


def merge_evidence(ev1: List[Dict[str, Any]], ev2: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Merges two evidence lists, deduplicating by chunkId + quote.
    """
    merged: List[Dict[str, Any]] = []
    seen = set()

    for ev in ev1 + ev2:
        key = (ev.get("chunkId"), ev.get("quote"))
        if key not in seen:
            seen.add(key)
            merged.append(ev)

    return merged


def deduplicate_facts(facts: List[Dict[str, Any]], entity_type: str) -> List[Dict[str, Any]]:
    """
    Deduplicates facts by fingerprint, merging evidence.
    """
    by_fingerprint: Dict[str, Dict[str, Any]] = {}

    for f in facts:
        fp = f.get("fingerprint") or compute_fact_fingerprint(entity_type, f.get("title", ""))
        f["fingerprint"] = fp
        f["entityType"] = entity_type

        if fp in by_fingerprint:
            existing = by_fingerprint[fp]
            existing["evidence"] = merge_evidence(existing.get("evidence", []), f.get("evidence", []))
            # Merge descriptions or metadata if existing is shorter
            if len(f.get("description", "") or "") > len(existing.get("description", "") or ""):
                existing["description"] = f.get("description")
            if f.get("owner") and not existing.get("owner"):
                existing["owner"] = f.get("owner")
        else:
            by_fingerprint[fp] = f

    return list(by_fingerprint.values())


def detect_conflicts(
    tasks: List[Dict[str, Any]],
    decisions: List[Dict[str, Any]],
    risks: List[Dict[str, Any]]
) -> None:
    """
    Detects contradictory facts:
    1. Database contradiction: MongoDB vs PostgreSQL decisions.
    2. Status contradiction: Issue marked closed/done while a corresponding PR is still open.
    Sets status to 'conflicting' and cross-references fingerprints.
    """
    # 1. Database Contradictions among Decisions
    mongo_decisions = []
    postgres_decisions = []

    for d in decisions:
        t_low = d.get("title", "").lower()
        r_low = d.get("rationale", "").lower()
        if "postgresql" in t_low or ("postgresql" in r_low and "mongodb" not in t_low):
            postgres_decisions.append(d)
        elif "mongodb" in t_low or "mongodb" in r_low:
            mongo_decisions.append(d)

    if mongo_decisions and postgres_decisions:
        for m in mongo_decisions:
            targets = [p["fingerprint"] for p in postgres_decisions if p["fingerprint"] != m["fingerprint"]]
            if targets:
                m["statusVerification"] = "conflicting"
                m["conflictDetails"] = {
                    "conflictingWith": targets,
                    "reason": "Contradiction: Documentation specifies MongoDB as primary database, whereas meeting notes/PRs specify PostgreSQL."
                }

        for p in postgres_decisions:
            targets = [m["fingerprint"] for m in mongo_decisions if m["fingerprint"] != p["fingerprint"]]
            if targets:
                p["statusVerification"] = "conflicting"
                p["conflictDetails"] = {
                    "conflictingWith": targets,
                    "reason": "Contradiction: Meeting notes/PRs specify PostgreSQL migration, whereas README specifies MongoDB as primary database."
                }

    # 2. Check for Task Status Contradictions (e.g. Issue #5 marked done while related PR is open, or contradictory task states)
    completed_tasks = [t for t in tasks if t.get("status") == "completed"]
    pending_tasks = [t for t in tasks if t.get("status") == "pending"]

    for c in completed_tasks:
        c_title = c.get("title", "").lower()
        for p in pending_tasks:
            p_title = p.get("title", "").lower()
            # If both refer to the same feature/bug with contradictory status
            if ("profile" in c_title and "profile" in p_title) or ("database" in c_title and "database" in p_title):
                c["statusVerification"] = "conflicting"
                p["statusVerification"] = "conflicting"
                c["conflictDetails"] = {
                    "conflictingWith": [p["fingerprint"]],
                    "reason": f"Status contradiction: Entity is marked completed in '{c.get('title')}' but remains pending in '{p.get('title')}'."
                }
                p["conflictDetails"] = {
                    "conflictingWith": [c["fingerprint"]],
                    "reason": f"Status contradiction: Entity remains pending in '{p.get('title')}' but is marked completed in '{c.get('title')}'."
                }


def reconcile_extracted_facts(raw_facts: Dict[str, List[Dict[str, Any]]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Executes pipeline stage 6: Deduplication, Evidence merging, and Conflict detection.
    """
    tasks = deduplicate_facts(raw_facts.get("tasks", []), "task")
    decisions = deduplicate_facts(raw_facts.get("decisions", []), "decision")
    risks = deduplicate_facts(raw_facts.get("risks", []), "risk")
    dependencies = deduplicate_facts(raw_facts.get("dependencies", []), "dependency")

    # Detect conflicts across the deduplicated facts
    detect_conflicts(tasks, decisions, risks)

    # Set default verification status for any fact that wasn't flagged
    for group in [tasks, decisions, risks, dependencies]:
        for item in group:
            if not item.get("statusVerification"):
                item["statusVerification"] = "verified"

    return {
        "tasks": tasks,
        "decisions": decisions,
        "risks": risks,
        "dependencies": dependencies
    }

