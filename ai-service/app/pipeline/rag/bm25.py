import math
import re
from collections import Counter
from typing import Any, Dict, List, Set, Tuple

ENGLISH_STOP_WORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "could", "did", "do",
    "does", "doing", "down", "during", "each", "few", "for", "from", "further",
    "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
    "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it",
    "its", "itself", "me", "more", "most", "my", "myself", "no", "nor", "not",
    "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours",
    "ourselves", "out", "over", "own", "same", "she", "should", "so", "some",
    "such", "than", "that", "the", "their", "theirs", "them", "themselves",
    "then", "there", "these", "they", "this", "those", "through", "to", "too",
    "under", "until", "up", "very", "was", "we", "were", "what", "when",
    "where", "which", "while", "who", "whom", "why", "with", "would", "you",
    "your", "yours", "yourself", "yourselves"
}


TECH_SYNONYMS: Dict[str, List[str]] = {
    "database": ["db", "mongodb", "postgres", "postgresql", "sql", "nosql", "datastore", "schema", "tables", "collections"],
    "db": ["database", "mongodb", "postgres", "postgresql", "sql", "schema"],
    "postgres": ["postgresql", "postgres", "database", "sql", "rds", "relational"],
    "postgresql": ["postgres", "postgresql", "database", "sql", "rds", "relational"],
    "mongodb": ["mongo", "atlas", "database", "nosql", "collections", "documents"],
    "auth": ["authentication", "authorization", "jwt", "token", "session", "login", "cookie", "rbac", "permissions"],
    "authentication": ["auth", "authorization", "jwt", "tokens", "session", "login", "rbac"],
    "api": ["endpoint", "route", "controller", "rest", "http", "service", "request", "response"],
    "backend": ["server", "express", "node", "fastapi", "python", "service", "api"],
    "frontend": ["client", "react", "ui", "vite", "component", "tailwind", "pages"],
    "dependency": ["requires", "package", "library", "service", "external", "imports"],
    "decision": ["decided", "chosen", "architecture", "choice", "tradeoff", "consensus", "agreed"],
    "task": ["todo", "pending", "completed", "work", "feature", "issue", "ticket", "pr", "pull request"],
    "risk": ["blocker", "problem", "bottleneck", "pitfall", "question", "missing", "unresolved"],
    "owner": ["responsibility", "lead", "contact", "developer", "assigned", "author"],
    "deploy": ["deployment", "render", "vercel", "docker", "docker-compose", "hosting", "cloud"],
    "test": ["testing", "jest", "pytest", "e2e", "assertion", "coverage", "verify"],
}


def tokenize(text: str) -> List[str]:
    """Tokenizes text into lowercase alphanumeric words."""
    if not text:
        return []
    return re.findall(r"\w+", text.lower())


def extract_content_tokens(text: str) -> List[str]:
    """Tokenizes text and strips common stop words for high-signal keyword matching."""
    all_tokens = tokenize(text)
    filtered = [t for t in all_tokens if t not in ENGLISH_STOP_WORDS]
    return filtered if filtered else all_tokens


def expand_query_tokens(text: str) -> List[str]:
    """Tokenizes query and expands with domain-specific technical synonyms for semantic awareness."""
    base_tokens = extract_content_tokens(text)
    expanded: List[str] = list(base_tokens)
    for token in base_tokens:
        synonyms = TECH_SYNONYMS.get(token, [])
        for syn in synonyms:
            if syn not in expanded:
                expanded.append(syn)
    return expanded


class BM25Index:
    """Okapi BM25 ranking model for grounded lexical retrieval over document chunks.

    Provides deterministic, free, high-precision keyword and phrase retrieval at $0 operating cost.
    Does not require external embeddings or paid API endpoints.
    """

    def __init__(self, chunks: List[Dict[str, Any]], k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.chunks = chunks
        self.corpus_size = len(chunks)
        self.doc_lengths: List[int] = []
        self.doc_term_freqs: List[Counter] = []
        self.df: Counter = Counter()

        total_len = 0
        for chunk in chunks:
            text = chunk.get("text", "")
            tokens = tokenize(text)
            length = len(tokens)
            self.doc_lengths.append(length)
            total_len += length

            term_counts = Counter(tokens)
            self.doc_term_freqs.append(term_counts)

            for term in term_counts.keys():
                self.df[term] += 1

        self.avg_doc_len = total_len / self.corpus_size if self.corpus_size > 0 else 1.0

    def idf(self, term: str) -> float:
        """Computes Robertson-Spärck Jones IDF with floor to ensure positive weights."""
        n_q = self.df.get(term, 0)
        return math.log(((self.corpus_size - n_q + 0.5) / (n_q + 0.5)) + 1.0)

    def score_chunk(self, query_tokens: List[str], chunk_idx: int) -> float:
        """Scores a single chunk against query tokens using Okapi BM25."""
        if not query_tokens or chunk_idx >= self.corpus_size:
            return 0.0

        dl = self.doc_lengths[chunk_idx]
        tf_map = self.doc_term_freqs[chunk_idx]
        score = 0.0

        for term in query_tokens:
            if term not in tf_map:
                continue
            tf = tf_map[term]
            term_idf = self.idf(term)
            numerator = tf * (self.k1 + 1.0)
            denominator = tf + self.k1 * (1.0 - self.b + self.b * (dl / self.avg_doc_len))
            score += term_idf * (numerator / denominator)

        return score

    def search(self, query: str, top_k: int = 5) -> List[Tuple[float, Dict[str, Any]]]:
        """Returns top_k chunks sorted by BM25 relevance score for meaningful query terms."""
        if not self.chunks or not query.strip():
            return []

        query_tokens = extract_content_tokens(query)
        if not query_tokens:
            return []

        scored: List[Tuple[float, Dict[str, Any]]] = []
        for idx, chunk in enumerate(self.chunks):
            s = self.score_chunk(query_tokens, idx)
            if s > 0.0:
                scored.append((s, chunk))

        # Sort descending by BM25 score
        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[:top_k]

    def search_semantic(self, query: str, top_k: int = 5) -> List[Tuple[float, Dict[str, Any]]]:
        """Hybrid semantic retrieval using primary query tokens weighted at 1.0 and domain synonyms at 0.5."""
        if not self.chunks or not query.strip():
            return []

        primary_tokens = extract_content_tokens(query)
        if not primary_tokens:
            return []

        expanded_tokens = expand_query_tokens(query)
        synonym_tokens = [t for t in expanded_tokens if t not in primary_tokens]

        scored: List[Tuple[float, Dict[str, Any]]] = []
        for idx, chunk in enumerate(self.chunks):
            primary_score = self.score_chunk(primary_tokens, idx)
            synonym_score = self.score_chunk(synonym_tokens, idx) if synonym_tokens else 0.0

            # Direct hits get 1.0 weight, semantic expansion gets 0.4 weight
            total_score = primary_score + (0.4 * synonym_score)
            if total_score > 0.0:
                scored.append((total_score, chunk))

        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[:top_k]
