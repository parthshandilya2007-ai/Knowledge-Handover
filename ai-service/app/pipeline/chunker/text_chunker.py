import hashlib
import uuid
from typing import List, Dict, Any
from app.pipeline.parsers.base import ParsedDocument


def chunk_document(
    parsed_doc: ParsedDocument,
    source_id: str,
    project_id: str,
    chunk_size_chars: int = 2000,
    overlap_chars: int = 250
) -> List[Dict[str, Any]]:
    """
    Splits a ParsedDocument into chunks of ~500-800 tokens with ~80 token overlap.
    Attaches locators, computes textHash, and generates unique chunk IDs.
    """
    raw_text = parsed_doc.raw_text.strip()
    if not raw_text:
        return []

    chunks = []
    start = 0
    order = 1
    text_len = len(raw_text)

    while start < text_len:
        end = min(start + chunk_size_chars, text_len)

        # If not at the end of the text, try to break cleanly at paragraph or newline boundary
        if end < text_len:
            split_candidates = [
                raw_text.rfind("\n\n", start, end),
                raw_text.rfind("\n", start, end),
                raw_text.rfind(". ", start, end),
                raw_text.rfind(" ", start, end)
            ]
            valid_candidates = [c for c in split_candidates if c > start + (chunk_size_chars // 2)]
            if valid_candidates:
                end = max(valid_candidates) + 1

        chunk_text = raw_text[start:end].strip()

        if chunk_text:
            # Match locator from parsed_doc
            matched_locator = {}
            for loc in parsed_doc.locators:
                # If locator text shares overlap with chunk_text
                sample = loc.text[:50]
                if sample in chunk_text or chunk_text[:50] in loc.text:
                    if loc.page is not None:
                        matched_locator["page"] = loc.page
                    if loc.paragraph is not None:
                        matched_locator["paragraph"] = loc.paragraph
                    if loc.lineStart is not None:
                        matched_locator["lineStart"] = loc.lineStart
                        matched_locator["lineEnd"] = loc.lineEnd
                    if loc.itemType is not None:
                        matched_locator["itemType"] = loc.itemType
                    if loc.itemId is not None:
                        matched_locator["itemId"] = loc.itemId
                    if loc.url is not None:
                        matched_locator["url"] = loc.url
                    break

            # Fallback locator if no specific boundary matched
            if not matched_locator and parsed_doc.locators:
                first = parsed_doc.locators[0]
                if first.page is not None:
                    matched_locator["page"] = first.page
                if first.lineStart is not None:
                    matched_locator["lineStart"] = first.lineStart

            text_hash = hashlib.sha256(chunk_text.encode("utf-8")).hexdigest()
            chunk_id = str(uuid.uuid4())

            chunks.append({
                "chunkId": chunk_id,
                "sourceId": source_id,
                "projectId": project_id,
                "order": order,
                "text": chunk_text,
                "textHash": text_hash,
                "locator": matched_locator
            })
            order += 1

        if end >= text_len:
            break

        start = end - overlap_chars
        if start >= end:
            start = end

    return chunks
