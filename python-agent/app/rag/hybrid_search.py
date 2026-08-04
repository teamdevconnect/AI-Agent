"""Hybrid retrieval: broadens the initial vector candidate pool from Qdrant,
fuses it with lexical (BM25) scoring computed over just that candidate set —
no separate persistent BM25 index, no Qdrant collection schema change, safe
to layer on top of the already-populated production collection — then
reranks the fused result with a cross-encoder (app.rag.reranker) for the
final order.

Pure vector search misses exact keyword/ID/name matches a lexical score
catches easily (a deal name, a contact email, an exact SOP term). This is
the standard bi-encoder-recall + lexical-precision + cross-encoder-rerank
pipeline shape, built without adding new infrastructure.
"""

from rank_bm25 import BM25Okapi

from app.rag.embeddings import embed_one
from app.rag.reranker import rerank
from app.rag.vector_store import search as vector_search

CANDIDATE_POOL_SIZE = 20


def _tokenize(text: str) -> list[str]:
    return text.lower().split()


def _bm25_scores(query: str, candidates: list[dict], text_key: str) -> list[float]:
    if len(candidates) < 2:
        return [1.0] * len(candidates)
    corpus = [_tokenize(c.get(text_key, "")) for c in candidates]
    bm25 = BM25Okapi(corpus)
    return list(bm25.get_scores(_tokenize(query)))


def _normalize(values: list[float]) -> list[float]:
    if not values:
        return []
    lo, hi = min(values), max(values)
    if hi == lo:
        return [0.0 for _ in values]
    return [(v - lo) / (hi - lo) for v in values]


def search(query: str, query_filter, top_k: int = 5, text_key: str = "text", pool_size: int = CANDIDATE_POOL_SIZE) -> list[dict]:
    """Vector recall -> BM25+vector fusion -> cross-encoder rerank -> top_k.
    query_filter is passed straight through to app.rag.vector_store.search —
    the same qdrant_client Filter objects every existing caller already
    builds, unchanged."""
    candidates = vector_search(embed_one(query), top_k=pool_size, query_filter=query_filter)
    if not candidates:
        return []

    vector_scores = _normalize([c.get("score", 0.0) for c in candidates])
    lexical_scores = _normalize(_bm25_scores(query, candidates, text_key))
    fused = sorted(
        zip(candidates, vector_scores, lexical_scores),
        key=lambda item: 0.5 * item[1] + 0.5 * item[2],
        reverse=True,
    )
    fused_candidates = [c for c, _, _ in fused[:pool_size]]

    return rerank(query, fused_candidates, text_key=text_key, top_k=top_k)
