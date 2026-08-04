from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.agent.anthropic_client import recommend_next_actions
from app.security import get_current_user

router = APIRouter()


class TaskIn(BaseModel):
    id: str
    title: str
    priority: str
    isOverdue: bool = False
    category: str | None = None


class RecommendTasksRequest(BaseModel):
    tasks: list[TaskIn]


class Recommendation(BaseModel):
    taskId: str
    rationale: str


class RecommendTasksResponse(BaseModel):
    recommendations: list[Recommendation]
    overallNote: str


@router.post("/tasks/recommend", response_model=RecommendTasksResponse)
def recommend_tasks(payload: RecommendTasksRequest, user: dict = Depends(get_current_user)):
    if not payload.tasks:
        return RecommendTasksResponse(recommendations=[], overallNote="Nothing open right now.")
    return RecommendTasksResponse(**recommend_next_actions([t.model_dump() for t in payload.tasks]))
