"""Cross-encoder reranking — a second, more precise relevance pass over an
initial candidate set from vector/hybrid search. Bi-encoder embeddings
(app.rag.embeddings) score query and passage independently, which is fast
but approximate; a cross-encoder scores the (query, passage) pair jointly —
slower per-pair but substantially more accurate. Standard retrieval-pipeline
shape: cheap bi-encoder for broad recall, precise cross-encoder to reorder
the top of it. Already part of the installed sentence-transformers package
— no new heavy dependency for this.
"""

from functools import lru_cache

from sentence_transformers import CrossEncoder

_MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"


@lru_cache
def _model() -> CrossEncoder:
    return CrossEncoder(_MODEL_NAME)


def rerank(query: str, candidates: list[dict], text_key: str = "text", top_k: int = 5) -> list[dict]:
    """Reorders candidates by cross-encoder relevance to query, returning the
    top_k. Fail-open: a scoring error returns the original candidates
    unchanged (truncated to top_k) rather than raising — reranking is a
    quality improvement, not something retrieval should ever hard-fail on.
    """
    if not candidates:
        return []
    try:
        pairs = [(query, c.get(text_key, "")) for c in candidates]
        scores = _model().predict(pairs)
        ranked = sorted(zip(candidates, scores), key=lambda pair: pair[1], reverse=True)
        return [c for c, _ in ranked[:top_k]]
    except Exception:
        return candidates[:top_k]
