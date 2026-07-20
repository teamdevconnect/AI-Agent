import uuid
from functools import lru_cache

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from app.config import settings
from app.rag.embeddings import vector_size


@lru_cache
def get_client() -> QdrantClient:
    return QdrantClient(url=settings.qdrant_url)


_collection_ready = False


def ensure_collection() -> None:
    global _collection_ready
    if _collection_ready:
        return

    client = get_client()
    if not client.collection_exists(settings.qdrant_collection):
        client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=qmodels.VectorParams(
                size=vector_size(), distance=qmodels.Distance.COSINE
            ),
        )

    # Filtered search (by user_id/source_type) degrades to a full scan
    # without a payload index on the filtered fields.
    indexed = set(client.get_collection(settings.qdrant_collection).payload_schema)
    for field in ("user_id", "source_type"):
        if field not in indexed:
            client.create_payload_index(
                collection_name=settings.qdrant_collection,
                field_name=field,
                field_schema=qmodels.PayloadSchemaType.KEYWORD,
            )

    _collection_ready = True


def upsert_points(points: list[qmodels.PointStruct]) -> None:
    ensure_collection()
    get_client().upsert(collection_name=settings.qdrant_collection, points=points)


def upsert_chunks(document_id: str, user_id: str, filename: str, chunks: list[str], vectors: list[list[float]]) -> None:
    points = [
        qmodels.PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "source_type": "document",
                "document_id": document_id,
                "user_id": user_id,
                "filename": filename,
                "chunk_index": i,
                "text": chunk,
            },
        )
        for i, (chunk, vector) in enumerate(zip(chunks, vectors))
    ]
    upsert_points(points)


def search(
    vector: list[float],
    top_k: int = 5,
    query_filter: qmodels.Filter | None = None,
) -> list[dict]:
    ensure_collection()
    results = get_client().query_points(
        collection_name=settings.qdrant_collection,
        query=vector,
        limit=top_k,
        query_filter=query_filter,
    ).points
    return [{"score": r.score, **r.payload} for r in results]
