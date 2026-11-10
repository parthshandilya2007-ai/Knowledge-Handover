from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ChatCitation(BaseModel):
    chunkId: str
    sourceId: str
    quote: str
    locator: Optional[Dict[str, Any]] = None
    sourceTitle: Optional[str] = None
    url: Optional[str] = None


class ChatRequest(BaseModel):
    projectId: str
    question: str
    allowedSourceIds: List[str] = Field(
        default_factory=list,
        description="Pre-filtered list of source IDs the requesting user is authorized to view.",
    )
    conversationHistory: Optional[List[Dict[str, str]]] = Field(
        default_factory=list,
        description="Optional list of previous messages [{'role': 'user'|'assistant', 'content': '...'}]",
    )


class ChatResponseData(BaseModel):
    answer: str
    citations: List[ChatCitation] = Field(default_factory=list)
    suggestedActions: List[str] = Field(default_factory=list)
    insufficientEvidence: bool = False


class ChatResponse(BaseModel):
    ok: bool = True
    data: ChatResponseData

