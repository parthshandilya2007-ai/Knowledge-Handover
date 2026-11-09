from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field


class GeneratedFactRef(BaseModel):
    kind: Literal["task", "decision", "risk", "dependency"]
    id: str


class GeneratedReportItem(BaseModel):
    id: str
    text: str
    factRefs: List[GeneratedFactRef] = Field(default_factory=list)
    citations: List[str] = Field(
        default_factory=list,
        description="Evidence IDs supporting the claim made in this item."
    )
    flag: Optional[Literal["no_evidence", "uncertain", "conflict"]] = None
    reviewStatus: Literal["pending", "approved", "edited", "rejected"] = "pending"


class GeneratedReportSection(BaseModel):
    key: str
    title: str
    items: List[GeneratedReportItem] = Field(default_factory=list)


class ReportGenerateRequest(BaseModel):
    projectId: str
    projectName: Optional[str] = "Project Handover"
    facts: Dict[str, List[Dict[str, Any]]] = Field(
        default_factory=lambda: {
            "tasks": [],
            "decisions": [],
            "risks": [],
            "dependencies": []
        }
    )
    evidenceMap: Optional[Dict[str, Dict[str, Any]]] = Field(
        default_factory=dict,
        description="Map of evidenceId -> { quote, sourceTitle, sourceType, locator, url }"
    )


class ReportGenerateResponseData(BaseModel):
    projectId: str
    sections: List[GeneratedReportSection]


class ReportGenerateResponse(BaseModel):
    ok: bool = True
    data: ReportGenerateResponseData
