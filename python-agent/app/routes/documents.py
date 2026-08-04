import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile

from app.events.bus import emit
from app.models.schemas import IngestResponse
from app.rag.embeddings import embed
from app.rag.loader import load_text
from app.rag.splitter import split_text
from app.rag.vector_store import upsert_chunks
from app.security import get_current_user

router = APIRouter()


@router.post("/documents/ingest", response_model=IngestResponse)
async def ingest(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Form(...),
    user: dict = Depends(get_current_user),
):
    content = await file.read()
    text = load_text(file.filename, content)
    chunks = split_text(text)
    if not chunks:
        return IngestResponse(document_id="", chunks=0, status="empty")

    document_id = str(uuid.uuid4())
    vectors = embed(chunks)
    upsert_chunks(document_id, user_id, file.filename, chunks, vectors)

    # Runs after the response is sent (app.workflows.definitions summarizes
    # and saves the summary as long-term memory) — an upload shouldn't block
    # on an LLM call just to fire an event no caller here needs to wait for.
    background_tasks.add_task(
        emit, "document.uploaded", {"document_id": document_id, "filename": file.filename, "user_id": user_id}
    )

    return IngestResponse(document_id=document_id, chunks=len(chunks), status="ingested")
