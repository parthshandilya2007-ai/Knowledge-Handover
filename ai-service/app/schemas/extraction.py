from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class ExtractedEvidence(BaseModel):
    chunkId: str
    quote: str = Field(description="Exact verbatim quote from the source chunk text supporting this claim.")


class ExtractedTask(BaseModel):
    title: str
    description: Optional[str] = None
    status: Literal["completed", "pending", "upcoming"] = "pending"
    owner: Optional[str] = None
    dueDate: Optional[str] = None
    evidence: List[ExtractedEvidence] = Field(default_factory=list)


class ExtractedDecision(BaseModel):
    title: str
    rationale: str
    alternativesConsidered: List[str] = Field(default_factory=list)
    decidedBy: Optional[str] = None
    decidedAt: Optional[str] = None
    status: Literal["accepted", "superseded", "deprecated"] = "accepted"
    evidence: List[ExtractedEvidence] = Field(default_factory=list)


class ExtractedRisk(BaseModel):
    title: str
    description: str
    severity: Literal["low", "medium", "high"] = "medium"
    kind: Literal["risk", "problem", "open_question", "missing_info"] = "risk"
    mitigation: Optional[str] = None
    evidence: List[ExtractedEvidence] = Field(default_factory=list)


class ExtractedDependency(BaseModel):
    consumer: str
    provider: str
    type: Literal["task", "component", "person", "service", "external"] = "task"
    description: Optional[str] = None
    evidence: List[ExtractedEvidence] = Field(default_factory=list)


class ExtractionResult(BaseModel):
    tasks: List[ExtractedTask] = Field(default_factory=list)
    decisions: List[ExtractedDecision] = Field(default_factory=list)
    risks: List[ExtractedRisk] = Field(default_factory=list)
    dependencies: List[ExtractedDependency] = Field(default_factory=list)

