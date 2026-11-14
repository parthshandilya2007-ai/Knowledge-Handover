import math
import logging
from typing import Any, Dict, List, Optional, Tuple
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
        # Advanced Hybrid BM25 with Domain Synonym Semantic Expansion
        scored_results = bm25.search_semantic(question, top_k=top_k)
        if scored_results:
            return [chunk for score, chunk in scored_results]
        # Fallback to standard BM25
        fallback_results = bm25.search(question, top_k=top_k)
        return [chunk for score, chunk in fallback_results]

    # 3. Advanced Hybrid Reciprocal Rank Fusion (RRF: Dense Vector Cosine Similarity + BM25 Lexical Ranking)
    from app.pipeline.embedder.embedder import get_embedder

    embedder = get_embedder()
    query_embeddings = await embedder.embed_texts([question])
    query_vec = query_embeddings[0] if query_embeddings else None

    # Step A: Dense ranking
    dense_scores: List[Tuple[float, int]] = []
    for i, ch in enumerate(chunks):
        ch_vec = ch.get("embedding")
        cos = _cosine_similarity(query_vec, ch_vec) if (query_vec and ch_vec) else 0.0
        dense_scores.append((cos, i))
    dense_scores.sort(key=lambda x: x[0], reverse=True)
    dense_rank_map = {idx: rank for rank, (_, idx) in enumerate(dense_scores)}

    # Step B: Semantic BM25 ranking
    bm25_semantic_results = bm25.search_semantic(question, top_k=len(chunks))
    bm25_rank_map = {
        chunks.index(ch): rank for rank, (_, ch) in enumerate(bm25_semantic_results)
    }

    # Step C: Reciprocal Rank Fusion (RRF k=60) + Architecture Context Boost
    rrf_scored = []
    K_RRF = 60

    for i, ch in enumerate(chunks):
        rank_dense = dense_rank_map.get(i, len(chunks))
        rank_bm25 = bm25_rank_map.get(i, len(chunks))

        rrf_score = (1.0 / (K_RRF + rank_dense)) + (1.2 / (K_RRF + rank_bm25))

        # Contextual boost: chunks with architectural decisions or technical keywords get high-signal boost
        text_lower = ch.get("text", "").lower()
        if any(kw in text_lower for kw in ["database", "postgresql", "mongodb", "architecture", "decision", "risk"]):
            rrf_score *= 1.15

        if rank_bm25 < len(chunks) or rank_dense < 10:
            rrf_scored.append((rrf_score, ch))

    rrf_scored.sort(key=lambda x: x[0], reverse=True)
    if rrf_scored:
        return [ch for _, ch in rrf_scored[:top_k]]

    return chunks[:top_k]
