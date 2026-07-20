from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI

from app.config import settings
from app.rag.business_sync import sync_all
from app.routes import chat, documents, health, sync

app = FastAPI(title="AI Agent Service")

app.include_router(health.router)
app.include_router(chat.router)
app.include_router(documents.router)
app.include_router(sync.router)

# Keeps CRM/Outlook data indexed for search_business_context without anyone
# having to trigger it manually. Single-process deployment (no --workers,
# one python-agent replica) — safe as one in-process scheduler; re-sync is
# idempotent (see business_sync.py's deterministic point ids) so this would
# stay correct even if that topology ever changed, just redundant.
scheduler = BackgroundScheduler()


@app.on_event("startup")
def _start_scheduler():
    scheduler.add_job(sync_all, "interval", minutes=settings.rag_sync_interval_minutes, id="rag_sync")
    scheduler.start()


@app.on_event("shutdown")
def _stop_scheduler():
    scheduler.shutdown(wait=False)
