import math
import re
from typing import Any, Dict, List, Optional
from app.config import settings
from app.pipeline.chunk_store import get_chunks_by_project
from app.pipeline.embedder.embedder import OpenAIEmbedder, generate_deterministic_vector


def _cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    if not vec_a or not vec_b:
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


def _keyword_overlap_score(query: str, text: str) -> float:
    """Computes basic lexical term overlap between query and document text."""
    query_tokens = set(re.findall(r"\w+", query.lower()))
    if not query_tokens:
        return 0.0
    doc_tokens = set(re.findall(r"\w+", text.lower()))
    overlap = len(query_tokens.intersection(doc_tokens))
    return overlap / len(query_tokens)


async def retrieve_authorized_chunks(
    project_id: str,
    question: str,
    allowed_source_ids: List[str],
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """Retrieves top-k relevant chunks for a question, strictly pre-filtered by allowed source IDs.

    Enforces permission-awareness at the retrieval layer.
    """
    if not allowed_source_ids:
        return []

    # 1. Fetch authorized chunks for this project
    chunks = get_chunks_by_project(project_id, allowed_source_ids)
    if not chunks:
        return []

    # 2. Compute query embedding
    embedder = OpenAIEmbedder(
        api_key=settings.OPENAI_API_KEY, model=settings.OPENAI_EMBEDDING_MODEL
    )
    query_embeddings = await embedder.embed_texts([question])
    query_vec = query_embeddings[0] if query_embeddings else generate_deterministic_vector(question)

    # 3. Score chunks using combination of semantic cosine similarity and lexical overlap
    scored_chunks = []
    for ch in chunks:
        ch_vec = ch.get("embedding")
        text = ch.get("text", "")
        cos_score = _cosine_similarity(query_vec, ch_vec) if ch_vec else 0.0
        lex_score = _keyword_overlap_score(question, text)

        # Combined hybrid relevance score
        combined_score = 0.6 * cos_score + 0.4 * lex_score

        if combined_score > 0.1:  # Basic relevance threshold
            scored_chunks.append((combined_score, ch))

    # Sort descending by score
    scored_chunks.sort(key=lambda x: x[0], reverse=True)

    top_chunks = [ch for _, ch in scored_chunks[:top_k]]
    return top_chunks
