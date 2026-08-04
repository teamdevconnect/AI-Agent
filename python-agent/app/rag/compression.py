"""Extractive context compression — trims a retrieved passage down to its
most query-relevant sentences before it reaches the LLM, instead of handing
over the full chunk verbatim. Reduces token usage and noise on longer
chunks; reuses the same bi-encoder (app.rag.embeddings) already loaded for
retrieval, no extra model or API call.
"""

import re

import numpy as np

from app.rag.embeddings import embed, embed_one

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def compress(query: str, text: str, max_sentences: int = 4) -> str:
    sentences = [s.strip() for s in _SENTENCE_SPLIT.split(text) if s.strip()]
    if len(sentences) <= max_sentences:
        return text

    query_vec = np.array(embed_one(query))
    sentence_vecs = np.array(embed(sentences))
    scores = sentence_vecs @ query_vec  # embeddings are normalized, so this is cosine similarity

    top_indices = set(np.argsort(scores)[-max_sentences:])
    # Keep original sentence order rather than relevance order — reads more naturally.
    return " ".join(s for i, s in enumerate(sentences) if i in top_indices)
