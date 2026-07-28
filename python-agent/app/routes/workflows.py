from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.security import get_current_user
from app.workflows.engine import list_workflows, run_workflow

router = APIRouter()


@router.get("/workflows")
def get_workflows(user: dict = Depends(get_current_user)):
    return {"workflows": list_workflows()}


class RunWorkflowRequest(BaseModel):
    context: dict = {}


@router.post("/workflows/{name}/run")
def run(name: str, payload: RunWorkflowRequest, user: dict = Depends(get_current_user)):
    # user_id defaults to whoever triggered this run — workflows that notify
    # (app.notifications.client, see app.workflows.definitions) need a real
    # recipient; explicit context still wins (e.g. app.events.bus's
    # document.uploaded payload already names the uploader).
    context = {"user_id": user.get("sub"), **payload.context}
    return run_workflow(name, context)
