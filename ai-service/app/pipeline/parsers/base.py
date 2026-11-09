from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class DocumentLocator(BaseModel):
  page: Optional[int] = None
  paragraph: Optional[int] = None
  lineStart: Optional[int] = None
  lineEnd: Optional[int] = None
  itemType: Optional[str] = None
  itemId: Optional[str] = None
  url: Optional[str] = None
  text: str


class ParsedDocument(BaseModel):
  raw_text: str
  locators: List[DocumentLocator]
  metadata: Dict[str, Any] = {}
