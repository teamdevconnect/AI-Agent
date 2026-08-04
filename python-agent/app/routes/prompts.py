from fastapi import APIRouter, Depends

from app.prompts.registry import list_prompts
from app.security import get_current_user

router = APIRouter()


@router.get("/prompts")
def get_prompts(user: dict = Depends(get_current_user)):
    return {"prompts": list_prompts()}
