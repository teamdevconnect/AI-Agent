from fastapi import APIRouter, Depends

from app.rag.business_sync import sync_all
from app.security import get_current_user

router = APIRouter()


@router.post("/sync/business-context/run")
def run_sync(user: dict = Depends(get_current_user)):
    return sync_all()
