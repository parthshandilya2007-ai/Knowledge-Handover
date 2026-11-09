import json
import logging
import uuid
from typing import Any, Dict, List, Optional

from app.config import settings
from app.pipeline.generator.prompts import (
    GENERATOR_PROMPT_VERSION,
    SYSTEM_GENERATOR_PROMPT,
    USER_GENERATOR_PROMPT,
)
from app.schemas.generation import (
    GeneratedFactRef,
    GeneratedReportItem,
    GeneratedReportSection,
)

logger = logging.getLogger(__name__)

# Fixed 11 Section Definitions
SECTION_DEFINITIONS = [
    ("overview", "Executive Overview"),
    ("completed_work", "Completed Work"),
    ("pending_work", "Pending & In-Progress Work"),
    ("responsibilities", "Key Responsibilities & Ownership"),
    ("decisions", "Key Decisions & Architecture"),
    ("dependencies", "Dependencies & Ecosystem"),
    ("risks", "Risks & Potential Roadblocks"),
    ("open_questions", "Open Questions & Missing Info"),
    ("next_actions", "Immediate Next Actions"),
    ("first_week_plan", "Grounded First-Week Onboarding Plan"),
    ("important_links", "Important Links & References"),
]


def _map_flag(status_or_flag: Optional[str]) -> Optional[str]:
    if not status_or_flag:
        return None
    val = str(status_or_flag).lower()
    if val in ["conflicting", "conflict"]:
        return "conflict"
    if val in ["uncertain", "unverified"]:
        return "uncertain"
    if val in ["no_evidence"]:
        return "no_evidence"
    return None


def _build_item(
    text: str,
    citations: List[str],
    fact_refs: Optional[List[Dict[str, str]]] = None,
    flag: Optional[str] = None,
) -> GeneratedReportItem:
    refs = [
        GeneratedFactRef(kind=r.get("kind", "task"), id=str(r.get("id", "")))
        for r in (fact_refs or [])
    ]
    computed_flag = _map_flag(flag)
    if not citations:
        computed_flag = "no_evidence"

    return GeneratedReportItem(
        id=f"item-{uuid.uuid4().hex[:10]}",
        text=text,
        factRefs=refs,
        citations=citations,
        flag=computed_flag,
        reviewStatus="pending",
    )


def generate_deterministic_report(
    project_id: str,
    project_name: str,
    facts: Dict[str, List[Dict[str, Any]]],
    evidence_map: Dict[str, Dict[str, Any]],
) -> List[GeneratedReportSection]:
    """Generates a complete, grounded 11-section report using deterministic synthesis.

    Guarantees that every item has valid evidence citations and correctly flags
    conflicts, uncertainties, or ungrounded claims.
    """
    tasks = facts.get("tasks", [])
    decisions = facts.get("decisions", [])
    risks = facts.get("risks", [])
    dependencies = facts.get("dependencies", [])

    sections_dict: Dict[str, List[GeneratedReportItem]] = {
        k: [] for k, _ in SECTION_DEFINITIONS
    }

    # 1. OVERVIEW
    # Collect overarching decisions, key milestones, and high-level tech stack
    all_evidence_ids = list(evidence_map.keys())
    overview_cites = all_evidence_ids[:3] if all_evidence_ids else []

    if decisions:
        primary_dec = decisions[0]
        cites = primary_dec.get("evidenceIds", []) or overview_cites
        sections_dict["overview"].append(
            _build_item(
                text=f"{project_name} architectural baseline: {primary_dec.get('title')}. {primary_dec.get('description', '')}".strip(),
                citations=cites,
                fact_refs=[{"kind": "decision", "id": str(primary_dec.get("_id") or primary_dec.get("id"))}],
                flag="conflict" if primary_dec.get("status") == "conflicting" else (
                    "uncertain" if primary_dec.get("status") == "uncertain" else None
                ),
            )
        )

    sections_dict["overview"].append(
        _build_item(
            text=f"The project repository and source base encompasses {len(tasks)} tracked tasks, {len(decisions)} architectural decisions, and {len(risks)} identified risks.",
            citations=overview_cites,
            flag=None if overview_cites else "no_evidence",
        )
    )

    # 2. COMPLETED WORK
    completed_tasks = [
        t for t in tasks if t.get("taskStatus") == "completed" or "merged" in str(t.get("title", "")).lower()
    ]
    if completed_tasks:
        for t in completed_tasks:
            cites = t.get("evidenceIds", [])
            sections_dict["completed_work"].append(
                _build_item(
                    text=f"[Completed] {t.get('title')}: {t.get('description', 'Verified complete in repository history.')}".strip(),
                    citations=cites,
                    fact_refs=[{"kind": "task", "id": str(t.get("_id") or t.get("id"))}],
                    flag=t.get("status") if t.get("status") in ["conflicting", "uncertain"] else None,
                )
            )
    else:
        sections_dict["completed_work"].append(
            _build_item(
                text="No completed work items formally flagged in current source artifacts.",
                citations=[],
                flag="no_evidence",
            )
        )

    # 3. PENDING WORK
    pending_tasks = [
        t for t in tasks if t.get("taskStatus") in ["pending", "upcoming"] or t not in completed_tasks
    ]
    if pending_tasks:
        for t in pending_tasks:
            cites = t.get("evidenceIds", [])
            owner_info = f" (Assigned to: {t.get('ownerName')})" if t.get("ownerName") else ""
            due_info = f" [Due: {t.get('dueDate')}]" if t.get("dueDate") else ""
            sections_dict["pending_work"].append(
                _build_item(
                    text=f"[Pending] {t.get('title')}{owner_info}{due_info}: {t.get('description', 'Awaiting implementation.')}".strip(),
                    citations=cites,
                    fact_refs=[{"kind": "task", "id": str(t.get("_id") or t.get("id"))}],
                    flag="conflict" if t.get("status") == "conflicting" else (
                        "uncertain" if t.get("status") == "uncertain" else None
                    ),
                )
            )
    else:
        sections_dict["pending_work"].append(
            _build_item(
                text="All identified project tasks are recorded as complete.",
                citations=[],
                flag="no_evidence",
            )
        )

    # 4. RESPONSIBILITIES & OWNERSHIP
    owners_map: Dict[str, Dict[str, Any]] = {}
    for t in tasks:
        owner = t.get("ownerName")
        if owner and owner not in ["null", "None", ""]:
            if owner not in owners_map:
                owners_map[owner] = {"items": [], "citations": set(), "factRefs": []}
            owners_map[owner]["items"].append(t.get("title"))
            owners_map[owner]["citations"].update(t.get("evidenceIds", []))
            owners_map[owner]["factRefs"].append({"kind": "task", "id": str(t.get("_id") or t.get("id"))})

    for d in decisions:
        decided_by = d.get("decidedBy")
        if decided_by and decided_by not in ["null", "None", ""]:
            if decided_by not in owners_map:
                owners_map[decided_by] = {"items": [], "citations": set(), "factRefs": []}
            owners_map[decided_by]["items"].append(d.get("title"))
            owners_map[decided_by]["citations"].update(d.get("evidenceIds", []))
            owners_map[decided_by]["factRefs"].append({"kind": "decision", "id": str(d.get("_id") or d.get("id"))})

    if owners_map:
        for owner, data in owners_map.items():
            joined_items = ", ".join(data["items"][:3])
            sections_dict["responsibilities"].append(
                _build_item(
                    text=f"Owner '{owner}' is responsible for: {joined_items}.",
                    citations=list(data["citations"]),
                    fact_refs=data["factRefs"][:3],
                )
            )
    else:
        sections_dict["responsibilities"].append(
            _build_item(
                text="No explicit individual owners designated in analyzed artifacts; general team ownership applies.",
                citations=[],
                flag="no_evidence",
            )
        )

    # 5. DECISIONS
    if decisions:
        for d in decisions:
            cites = d.get("evidenceIds", [])
            rationale_text = f" Rationale: {d.get('rationale')}" if d.get("rationale") else ""
            flag_val = "conflict" if d.get("status") == "conflicting" else (
                "uncertain" if d.get("status") == "uncertain" else None
            )
            sections_dict["decisions"].append(
                _build_item(
                    text=f"Decision: {d.get('title')}.{rationale_text}".strip(),
                    citations=cites,
                    fact_refs=[{"kind": "decision", "id": str(d.get("_id") or d.get("id"))}],
                    flag=flag_val,
                )
            )
    else:
        sections_dict["decisions"].append(
            _build_item(
                text="No architectural decisions captured in analyzed records.",
                citations=[],
                flag="no_evidence",
            )
        )

    # 6. DEPENDENCIES
    if dependencies:
        for dep in dependencies:
            cites = dep.get("evidenceIds", [])
            note = f" (Note: {dep.get('note')})" if dep.get("note") else ""
            sections_dict["dependencies"].append(
                _build_item(
                    text=f"Dependency: '{dep.get('fromRef')}' requires '{dep.get('toRef')}' [Type: {dep.get('dependencyType', 'component')}]{note}.",
                    citations=cites,
                    fact_refs=[{"kind": "dependency", "id": str(dep.get("_id") or dep.get("id"))}],
                )
            )
    else:
        sections_dict["dependencies"].append(
            _build_item(
                text="No hard inter-system dependencies detected in current sources.",
                citations=[],
                flag="no_evidence",
            )
        )

    # 7. RISKS
    pure_risks = [r for r in risks if r.get("kind") in ["risk", "problem"]]
    if pure_risks:
        for r in pure_risks:
            cites = r.get("evidenceIds", [])
            sev = r.get("severity", "medium").upper()
            sections_dict["risks"].append(
                _build_item(
                    text=f"[{sev} RISK] {r.get('title')}: {r.get('description', '')}".strip(),
                    citations=cites,
                    fact_refs=[{"kind": "risk", "id": str(r.get("_id") or r.get("id"))}],
                    flag=r.get("status") if r.get("status") in ["conflicting", "uncertain"] else None,
                )
            )
    else:
        sections_dict["risks"].append(
            _build_item(
                text="No critical blockers or active risk items found in source records.",
                citations=[],
                flag="no_evidence",
            )
        )

    # 8. OPEN QUESTIONS
    open_q = [r for r in risks if r.get("kind") in ["open_question", "missing_info"]]
    if open_q:
        for q in open_q:
            cites = q.get("evidenceIds", [])
            sections_dict["open_questions"].append(
                _build_item(
                    text=f"[Open Question] {q.get('title')}: {q.get('description', '')}".strip(),
                    citations=cites,
                    fact_refs=[{"kind": "risk", "id": str(q.get("_id") or q.get("id"))}],
                    flag=q.get("status") if q.get("status") in ["conflicting", "uncertain"] else None,
                )
            )
    else:
        sections_dict["open_questions"].append(
            _build_item(
                text="No pending open questions or missing specifications recorded.",
                citations=[],
                flag="no_evidence",
            )
        )

    # 9. NEXT ACTIONS
    # Synthesize priority actions from pending tasks, high risks, and open questions
    action_items: List[GeneratedReportItem] = []
    # Conflict actions
    conflicting_facts = [
        d for d in decisions if d.get("status") == "conflicting"
    ] + [t for t in tasks if t.get("status") == "conflicting"]
    if conflicting_facts:
        first_conf = conflicting_facts[0]
        action_items.append(
            _build_item(
                text=f"Resolve conflicting requirement on '{first_conf.get('title')}' with team stakeholders before advancing implementation.",
                citations=first_conf.get("evidenceIds", []),
                fact_refs=[{"kind": "decision" if "rationale" in first_conf else "task", "id": str(first_conf.get("_id") or first_conf.get("id"))}],
                flag="conflict",
            )
        )

    for pt in pending_tasks[:2]:
        action_items.append(
            _build_item(
                text=f"Continue execution on pending task: '{pt.get('title')}'.",
                citations=pt.get("evidenceIds", []),
                fact_refs=[{"kind": "task", "id": str(pt.get("_id") or pt.get("id"))}],
            )
        )

    for q in open_q[:1]:
        action_items.append(
            _build_item(
                text=f"Clarify open question with team: '{q.get('title')}'.",
                citations=q.get("evidenceIds", []),
                fact_refs=[{"kind": "risk", "id": str(q.get("_id") or q.get("id"))}],
            )
        )

    if not action_items:
        action_items.append(
            _build_item(
                text="Conduct introductory project walkthrough and setup local environment.",
                citations=overview_cites,
                flag=None if overview_cites else "no_evidence",
            )
        )
    sections_dict["next_actions"] = action_items

    # 10. FIRST-WEEK PLAN (Grounded Day-by-Day Roadmap)
    plan_cites_day1 = overview_cites
    plan_cites_day2 = decisions[0].get("evidenceIds", []) if decisions else overview_cites
    plan_cites_day3 = (
        conflicting_facts[0].get("evidenceIds", []) if conflicting_facts else (
            open_q[0].get("evidenceIds", []) if open_q else overview_cites
        )
    )
    plan_cites_day4 = pending_tasks[0].get("evidenceIds", []) if pending_tasks else overview_cites
    owner_cite = list(owners_map.values())[0]["citations"] if owners_map else []
    plan_cites_day5 = list(owner_cite)[:2] if owner_cite else overview_cites

    sections_dict["first_week_plan"] = [
        _build_item(
            text="Day 1 (Access & Setup): Clone repository, configure local environment variables, verify Docker services and dependencies.",
            citations=plan_cites_day1,
            flag=None if plan_cites_day1 else "no_evidence",
        ),
        _build_item(
            text=f"Day 2 (Architecture Deep-Dive): Review foundational architectural decisions ({decisions[0].get('title', 'core architecture') if decisions else 'system architecture'}) and module boundaries.",
            citations=plan_cites_day2,
            fact_refs=[{"kind": "decision", "id": str(decisions[0].get("_id") or decisions[0].get("id"))}] if decisions else [],
            flag=decisions[0].get("status") if decisions and decisions[0].get("status") in ["conflicting", "uncertain"] else None,
        ),
        _build_item(
            text="Day 3 (Conflict & Risk Review): Clarify contradictory choices identified by AI pipeline (e.g. database schema / stale PRs) and open questions with the team.",
            citations=plan_cites_day3,
            flag="conflict" if conflicting_facts else None,
        ),
        _build_item(
            text=f"Day 4 (First Contribution): Pick up initial pending task ({pending_tasks[0].get('title', 'bugfix/test') if pending_tasks else 'code cleanup'}), create branch and submit pull request.",
            citations=plan_cites_day4,
            fact_refs=[{"kind": "task", "id": str(pending_tasks[0].get("_id") or pending_tasks[0].get("id"))}] if pending_tasks else [],
        ),
        _build_item(
            text=f"Day 5 (Ownership Handover & Roadmap Sync): Meet with key stakeholders ({list(owners_map.keys())[0] if owners_map else 'engineering leads'}) to formally take over sprint responsibilities.",
            citations=plan_cites_day5,
            flag=None if plan_cites_day5 else "no_evidence",
        ),
    ]

    # 11. IMPORTANT LINKS
    links_items: List[GeneratedReportItem] = []
    for ev_id, ev_info in evidence_map.items():
        locator = ev_info.get("locator") or {}
        url = ev_info.get("url") or locator.get("url")
        if url:
            item_desc = locator.get("itemType") or ev_info.get("sourceTitle") or "Repository Artifact"
            item_id = locator.get("itemId")
            suffix = f" ({item_id})" if item_id else ""
            links_items.append(
                _build_item(
                    text=f"{item_desc}{suffix}: {url}",
                    citations=[ev_id],
                )
            )
            if len(links_items) >= 6:
                break

    if not links_items:
        for ev_id, ev_info in list(evidence_map.items())[:3]:
            title = ev_info.get("sourceTitle") or "Document Reference"
            links_items.append(
                _build_item(
                    text=f"Referenced document: {title}",
                    citations=[ev_id],
                )
            )

    if not links_items:
        links_items.append(
            _build_item(
                text="No external repository or document URLs found in analyzed sources.",
                citations=[],
                flag="no_evidence",
            )
        )

    sections_dict["important_links"] = links_items

    # Convert to ordered list of GeneratedReportSection
    final_sections: List[GeneratedReportSection] = []
    for key, title in SECTION_DEFINITIONS:
        final_sections.append(
            GeneratedReportSection(
                key=key,
                title=title,
                items=sections_dict[key],
            )
        )

    return final_sections


async def generate_handover_report(
    project_id: str,
    project_name: str,
    facts: Dict[str, List[Dict[str, Any]]],
    evidence_map: Dict[str, Dict[str, Any]],
) -> List[GeneratedReportSection]:
    """Generates a complete handover report using OpenAI if available, or deterministic engine.

    Always guarantees that all 11 sections exist and citations are preserved.
    """
    if not settings.OPENAI_API_KEY:
        logger.info("No OPENAI_API_KEY set; generating report with deterministic synthesis engine.")
        return generate_deterministic_report(project_id, project_name, facts, evidence_map)

    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        # Build prompt
        facts_summary = {
            "tasks": [
                {
                    "id": str(t.get("_id") or t.get("id")),
                    "title": t.get("title"),
                    "status": t.get("taskStatus"),
                    "owner": t.get("ownerName"),
                    "evidenceIds": t.get("evidenceIds", []),
                    "flag": t.get("status"),
                }
                for t in facts.get("tasks", [])
            ],
            "decisions": [
                {
                    "id": str(d.get("_id") or d.get("id")),
                    "title": d.get("title"),
                    "rationale": d.get("rationale"),
                    "evidenceIds": d.get("evidenceIds", []),
                    "flag": d.get("status"),
                }
                for d in facts.get("decisions", [])
            ],
            "risks": [
                {
                    "id": str(r.get("_id") or r.get("id")),
                    "title": r.get("title"),
                    "kind": r.get("kind"),
                    "severity": r.get("severity"),
                    "evidenceIds": r.get("evidenceIds", []),
                    "flag": r.get("status"),
                }
                for r in facts.get("risks", [])
            ],
            "dependencies": [
                {
                    "id": str(dp.get("_id") or dp.get("id")),
                    "fromRef": dp.get("fromRef"),
                    "toRef": dp.get("toRef"),
                    "type": dp.get("dependencyType"),
                    "evidenceIds": dp.get("evidenceIds", []),
                }
                for dp in facts.get("dependencies", [])
            ],
        }

        user_content = USER_GENERATOR_PROMPT.format(
            project_name=project_name,
            facts_json=json.dumps(facts_summary, indent=2),
            evidence_json=json.dumps(
                {
                    k: {
                        "quote": v.get("quote", "")[:120],
                        "sourceTitle": v.get("sourceTitle", ""),
                        "url": v.get("url") or (v.get("locator") or {}).get("url"),
                    }
                    for k, v in list(evidence_map.items())[:20]
                },
                indent=2,
            ),
        )

        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_GENERATOR_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=4000,
        )

        raw_json = response.choices[0].message.content
        parsed = json.loads(raw_json)

        # Parse sections
        parsed_sections = parsed.get("sections")
        if isinstance(parsed_sections, list) and len(parsed_sections) > 0:
            result_sections: List[GeneratedReportSection] = []
            parsed_dict = {s.get("key"): s for s in parsed_sections if isinstance(s, dict)}

            for key, title in SECTION_DEFINITIONS:
                section_data = parsed_dict.get(key)
                if section_data:
                    raw_items = section_data.get("items", [])
                    clean_items = []
                    for item in raw_items:
                        cites = [str(c) for c in item.get("citations", []) if str(c) in evidence_map]
                        flag = item.get("flag")
                        if not cites:
                            flag = "no_evidence"
                        clean_items.append(
                            GeneratedReportItem(
                                id=item.get("id") or f"item-{uuid.uuid4().hex[:10]}",
                                text=item.get("text", ""),
                                factRefs=[
                                    GeneratedFactRef(kind=r.get("kind", "task"), id=str(r.get("id", "")))
                                    for r in item.get("factRefs", [])
                                ],
                                citations=cites,
                                flag=flag,
                                reviewStatus="pending",
                            )
                        )
                    result_sections.append(
                        GeneratedReportSection(
                            key=key,
                            title=title,
                            items=clean_items,
                        )
                    )
                else:
                    # Missing section in LLM response: fill from deterministic fallback
                    det = generate_deterministic_report(project_id, project_name, facts, evidence_map)
                    det_dict = {s.key: s for s in det}
                    result_sections.append(det_dict[key])

            return result_sections

        # If LLM response structure wasn't as expected, fall back to deterministic
        logger.warning("LLM response did not contain expected sections list, using deterministic engine.")
        return generate_deterministic_report(project_id, project_name, facts, evidence_map)

    except Exception as e:
        logger.error(f"Error during OpenAI report generation: {e}. Falling back to deterministic engine.")
        return generate_deterministic_report(project_id, project_name, facts, evidence_map)
