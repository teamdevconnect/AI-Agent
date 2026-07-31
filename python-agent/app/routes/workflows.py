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
    # user_id/organization_id default from whoever/whichever org triggered
    # this run — workflows that notify (app.notifications.client) need a
    # real recipient, and any that touch the CRM (Phase 7) need the right
    # org's credentials; explicit context still wins (e.g. app.events.bus's
    # document.uploaded payload already names the uploader, and NestJS's
    # workflow queue passes organization_id explicitly too — this default
    # only matters for direct/manual HTTP calls that omit it).
    context = {"user_id": user.get("sub"), "organization_id": user.get("organizationId"), **payload.context}
    return run_workflow(name, context)
