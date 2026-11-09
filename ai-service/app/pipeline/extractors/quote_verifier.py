import re
import logging
from typing import List, Dict, Optional, Tuple, Any

logger = logging.getLogger("ai-service.quote_verifier")


def normalize_whitespace(text: str) -> str:
    """
    Normalizes whitespace in a text string:
    - Replaces non-breaking spaces and other Unicode spaces with standard space
    - Collapses consecutive whitespace (spaces, tabs, newlines) into a single space
    - Strips leading and trailing whitespace
    """
    if not text:
        return ""
    # Replace non-breaking spaces and carriage returns
    cleaned = text.replace("\u00a0", " ").replace("\r\n", "\n").replace("\r", "\n")
    # Collapse multiple whitespace characters into single space
    return re.sub(r"\s+", " ", cleaned).strip()


def is_verbatim_substring(quote: str, source_text: str) -> bool:
    """
    Verifies that quote is a verbatim substring of source_text after whitespace normalization.
    """
    norm_quote = normalize_whitespace(quote)
    norm_source = normalize_whitespace(source_text)

    if not norm_quote or not norm_source:
        return False

    return norm_quote in norm_source


def verify_evidence_records(
    evidence_list: List[Any],
    chunk_map: Dict[str, str]
) -> Tuple[List[Dict[str, Any]], bool, Optional[str]]:
    """
    Validates a list of evidence records against the corresponding chunk texts.

    Returns:
    - valid_records: List of verified evidence records
    - is_verified: True if at least one evidence record was verified and none failed
    - reason: Explanatory string if evidence was dropped or failed
    """
    if not evidence_list:
        return [], False, "No evidence provided"

    valid_records: List[Dict[str, Any]] = []
    has_rejected_quote = False

    for item in evidence_list:
        chunk_id = getattr(item, "chunkId", None) if hasattr(item, "chunkId") else item.get("chunkId")
        quote = getattr(item, "quote", None) if hasattr(item, "quote") else item.get("quote")

        if not chunk_id or not quote:
            has_rejected_quote = True
            logger.warning(f"Dropping evidence: missing chunkId or quote: {item}")
            continue

        chunk_text = chunk_map.get(chunk_id)
        if not chunk_text:
            has_rejected_quote = True
            logger.warning(f"Dropping evidence: chunkId {chunk_id} not found in project chunks")
            continue

        if is_verbatim_substring(quote, chunk_text):
            valid_records.append({"chunkId": chunk_id, "quote": quote})
        else:
            has_rejected_quote = True
            logger.warning(
                f"Quote verification failed for chunk {chunk_id}. "
                f"Quote '{quote[:80]}...' is not a verbatim substring of chunk text."
            )

    if not valid_records:
        return [], False, "All evidence failed verbatim substring verification against source chunk"

    if has_rejected_quote:
        return valid_records, False, "Some evidence quotes failed verbatim substring verification"

    return valid_records, True, None

