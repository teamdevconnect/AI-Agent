from fastapi import APIRouter, Depends

from app.integrations.crm_mongo_sync import sync_all_orgs as sync_crm_deals_to_mongo
from app.integrations.crm_mongo_sync import sync_all_quote_orgs as sync_crm_quotes_to_mongo
from app.rag.business_sync import sync_all
from app.security import get_current_user

router = APIRouter()


@router.post("/sync/business-context/run")
def run_sync(user: dict = Depends(get_current_user)):
    return sync_all()


@router.post("/sync/crm-deals/run")
def run_crm_deal_sync(user: dict = Depends(get_current_user)):
    return sync_crm_deals_to_mongo()


@router.post("/sync/crm-quotes/run")
def run_crm_quote_sync(user: dict = Depends(get_current_user)):
    return sync_crm_quotes_to_mongo()
