import math
import logging
from typing import Any, Dict, List, Optional
from app.config import settings
from app.pipeline.chunk_store import get_chunks_by_project
from app.pipeline.rag.bm25 import BM25Index, tokenize

logger = logging.getLogger(__name__)


def _cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    if not vec_a or not vec_b:
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


async def retrieve_authorized_chunks(
    project_id: str,
    question: str,
    allowed_source_ids: List[str],
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """Retrieves top-k relevant chunks for a question, strictly pre-filtered by allowed source IDs.

    Enforces permission-awareness at the retrieval layer.
    In $0 free mode (no OPENAI_API_KEY): uses Okapi BM25 lexical ranking.
    When OPENAI_API_KEY is configured: combines BM25 with semantic embedding cosine similarity.
    """
    if not allowed_source_ids:
        return []

    # 1. Fetch authorized chunks for this project
    chunks = get_chunks_by_project(project_id, allowed_source_ids)
    if not chunks:
        return []

    # 2. Build BM25 index over authorized corpus
    bm25 = BM25Index(chunks)
    query_tokens = tokenize(question)

    has_openai = bool(
        settings.OPENAI_API_KEY
        and settings.OPENAI_API_KEY.strip()
        and settings.EMBEDDING_PROVIDER == "openai"
    )

    if not has_openai:
        # Grounded BM25 lexical retrieval (Zero-cost, deterministic, no pseudo-semantic claims)
        scored_results = bm25.search(question, top_k=top_k)
        return [chunk for score, chunk in scored_results]

    # 3. Hybrid search (OpenAI Embedding Cosine Similarity + BM25 Lexical Score)
    from app.pipeline.embedder.embedder import get_embedder

    embedder = get_embedder()
    query_embeddings = await embedder.embed_texts([question])
    query_vec = query_embeddings[0] if query_embeddings else None

    scored_chunks = []
    max_bm25 = 1.0

    bm25_scores = [bm25.score_chunk(query_tokens, i) for i in range(len(chunks))]
    if bm25_scores:
        max_bm25 = max(max(bm25_scores), 1.0)

    for i, ch in enumerate(chunks):
        ch_vec = ch.get("embedding")
        cos_score = _cosine_similarity(query_vec, ch_vec) if (query_vec and ch_vec) else 0.0
        norm_bm25 = bm25_scores[i] / max_bm25

        combined_score = 0.5 * cos_score + 0.5 * norm_bm25
        if combined_score > 0.05:
            scored_chunks.append((combined_score, ch))

    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    if scored_chunks:
        return [ch for _, ch in scored_chunks[:top_k]]

    return chunks[:top_k]
