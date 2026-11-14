import json
import logging
import re
from typing import Any, Dict, List, Optional

from app.config import settings
from app.pipeline.extractors.quote_verifier import is_verbatim_substring
from app.pipeline.rag.prompts import (
    ASSISTANT_PROMPT_VERSION,
    SYSTEM_ASSISTANT_PROMPT,
    USER_ASSISTANT_PROMPT,
)
from app.pipeline.rag.retriever import retrieve_authorized_chunks
from app.schemas.chat import ChatCitation, ChatResponseData

from app.pipeline.rag.bm25 import extract_content_tokens, expand_query_tokens

logger = logging.getLogger(__name__)


def _extract_grounded_snippet(text: str, query: str) -> str:
    """Extracts a sentence or snippet from text that contains meaningful query terms or semantic synonyms."""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    query_terms = set(extract_content_tokens(query))
    expanded_terms = set(expand_query_tokens(query))

    best_sentence = ""
    best_overlap = 0

    for s in sentences:
        s_terms = set(re.findall(r"\w+", s.lower()))
        direct_overlap = len(query_terms.intersection(s_terms))
        synonym_overlap = len(expanded_terms.intersection(s_terms))
        overlap = (direct_overlap * 2) + synonym_overlap
        if overlap > best_overlap:
            best_overlap = overlap
            best_sentence = s.strip()

    if best_sentence and best_overlap > 0:
        return best_sentence
    return ""


def synthesize_deterministic_chat_response(
    question: str, chunks: List[Dict[str, Any]]
) -> ChatResponseData:
    """Synthesizes a grounded answer and verbatim citations from retrieved chunks."""
    if not chunks:
        return ChatResponseData(
            answer="I couldn't find evidence for this in the authorised sources.",
            citations=[],
            suggestedActions=[
                "Verify that the necessary project source repositories or meeting notes are uploaded.",
                "Review the Handover Dashboard Overview tab for project baseline context.",
            ],
            insufficientEvidence=True,
        )

    # Compile citations and synthesize response from top chunks
    citations: List[ChatCitation] = []
    snippets: List[str] = []

    for ch in chunks[:3]:
        chunk_text = ch.get("text", "")
        quote = _extract_grounded_snippet(chunk_text, question)
        if quote and len(quote) > 10:
            citations.append(
                ChatCitation(
                    chunkId=ch.get("chunkId", "chk-ref"),
                    sourceId=ch.get("sourceId", ""),
                    quote=quote,
                    locator=ch.get("locator"),
                    sourceTitle=ch.get("sourceTitle") or "Project Artifact",
                    url=ch.get("locator", {}).get("url") if ch.get("locator") else None,
                )
            )
            snippets.append(quote)

    if not snippets:
        return ChatResponseData(
            answer="I couldn't find evidence for this in the authorised sources.",
            citations=[],
            suggestedActions=[
                "Check whether you have authorized access to restricted finance or architecture notes.",
            ],
            insufficientEvidence=True,
        )

    # Synthesize grounded answer
    primary_snippet = snippets[0]
    additional_snippet = f" Additionally, {snippets[1]}" if len(snippets) > 1 else ""

    grounded_answer = (
        f"Based on the authorized project records: {primary_snippet}{additional_snippet}"
    )

    suggested_actions = [
        "Review referenced pull request or commit history in GitHub.",
        "Check pending dependencies related to this component in the Handover Dashboard.",
        "Sync with engineering lead if requirements need further clarification.",
    ]

    return ChatResponseData(
        answer=grounded_answer,
        citations=citations,
        suggestedActions=suggested_actions,
        insufficientEvidence=False,
    )


async def answer_project_question(
    project_id: str,
    question: str,
    allowed_source_ids: List[str],
    conversation_history: Optional[List[Dict[str, str]]] = None,
) -> ChatResponseData:
    """Executes permission-aware RAG to answer project questions."""
    # 1. Retrieve chunks filtered strictly by allowedSourceIds
    retrieved_chunks = await retrieve_authorized_chunks(
        project_id=project_id,
        question=question,
        allowed_source_ids=allowed_source_ids,
        top_k=5,
    )

    if not retrieved_chunks:
        return ChatResponseData(
            answer="I couldn't find evidence for this in the authorised sources.",
            citations=[],
            suggestedActions=[
                "Request access to restricted project documents if required.",
                "Review open tasks and decisions on the Handover Dashboard.",
            ],
            insufficientEvidence=True,
        )

    # 2. If OpenAI is not configured, use deterministic synthesis
    if not settings.OPENAI_API_KEY:
        logger.info("No OPENAI_API_KEY set; using deterministic RAG response synthesis.")
        return synthesize_deterministic_chat_response(question, retrieved_chunks)

    # 3. Use OpenAI Structured Outputs
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        passages_payload = [
            {
                "chunkId": ch.get("chunkId"),
                "sourceId": ch.get("sourceId"),
                "text": ch.get("text", "")[:400],
                "locator": ch.get("locator"),
            }
            for ch in retrieved_chunks
        ]

        messages: List[Dict[str, str]] = [
            {"role": "system", "content": SYSTEM_ASSISTANT_PROMPT},
        ]

        if conversation_history:
            for msg in conversation_history[-4:]:
                messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})

        user_content = USER_ASSISTANT_PROMPT.format(
            question=question,
            passages_json=json.dumps(passages_payload, indent=2),
        )
        messages.append({"role": "user", "content": user_content})

        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=1500,
        )

        raw_json = response.choices[0].message.content
        parsed = json.loads(raw_json)

        insufficient = parsed.get("insufficientEvidence", False)
        answer_text = parsed.get("answer", "")

        raw_cites = parsed.get("citations", [])
        clean_citations: List[ChatCitation] = []

        chunk_lookup = {ch.get("chunkId"): ch for ch in retrieved_chunks}

        for c in raw_cites:
            c_chunk_id = c.get("chunkId")
            c_quote = c.get("quote", "")
            if c_chunk_id in chunk_lookup and c_quote:
                matching_chunk = chunk_lookup[c_chunk_id]
                # Programmatically verify verbatim quote substring
                if is_verbatim_substring(c_quote, matching_chunk.get("text", "")):
                    clean_citations.append(
                        ChatCitation(
                            chunkId=c_chunk_id,
                            sourceId=matching_chunk.get("sourceId", ""),
                            quote=c_quote,
                            locator=matching_chunk.get("locator"),
                            url=matching_chunk.get("locator", {}).get("url") if matching_chunk.get("locator") else None,
                        )
                    )

        suggested = parsed.get("suggestedActions", [])

        return ChatResponseData(
            answer=answer_text,
            citations=clean_citations,
            suggestedActions=suggested[:3],
            insufficientEvidence=insufficient,
        )

    except Exception as e:
        logger.error(f"Error during OpenAI RAG answer generation: {e}. Falling back to deterministic engine.")
        return synthesize_deterministic_chat_response(question, retrieved_chunks)

