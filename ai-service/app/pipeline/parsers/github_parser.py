from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.pipeline.parsers.base import ParsedDocument, DocumentLocator


class GithubItemInput(BaseModel):
    itemType: str
    itemId: str
    title: str
    url: Optional[str] = None
    text: str
    metadata: Optional[Dict[str, Any]] = None


def parse_github_items(items: List[Any], repo_name: str) -> ParsedDocument:
    """
    Normalizes a list of GitHub entities (README, commits, issues, PRs, branches)
    into a ParsedDocument with precise item-level locators.
    """
    raw_blocks: List[str] = []
    locators: List[DocumentLocator] = []

    for item in items:
        # Support either Pydantic model or dict
        if isinstance(item, dict):
            i_type = item.get("itemType", "doc")
            i_id = str(item.get("itemId", ""))
            i_title = item.get("title", "")
            i_url = item.get("url")
            i_text = item.get("text", "").strip()
        else:
            i_type = getattr(item, "itemType", "doc")
            i_id = str(getattr(item, "itemId", ""))
            i_title = getattr(item, "title", "")
            i_url = getattr(item, "url", None)
            i_text = getattr(item, "text", "").strip()

        block_header = f"[{i_type.upper()}: {i_id}] {i_title}"
        full_block = f"{block_header}\n{i_text}"
        raw_blocks.append(full_block)

        locators.append(
            DocumentLocator(
                itemType=i_type,
                itemId=i_id,
                url=i_url,
                text=i_text or block_header
            )
        )

    joined_text = "\n\n---\n\n".join(raw_blocks)

    return ParsedDocument(
        raw_text=joined_text,
        locators=locators,
        metadata={
            "sourceType": "github",
            "repo": repo_name,
            "totalItems": len(items)
        }
    )

