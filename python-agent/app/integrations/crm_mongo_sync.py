"""Mirrors an org's connected EXTERNAL CRM deals into the native `crm_deals`
Mongo collection (same collection/field names backend/src/crm/schemas/deal.schema.ts
and business-dashboard.service.ts already read) — this is what makes the
Owner/Manager/Consultant dashboards show real numbers for orgs that use an
external CRM instead of the native one, without changing a line of NestJS.

Deliberately separate from app.rag.business_sync (which indexes CRM data into
Qdrant for semantic search, is not org-aware, and never touches these
collections) — different concern, different write target.

Known limitation, not a bug: the external CRM (ProspectConnect/GHL-shaped)
carries no per-salesperson assignment on a deal (its `team_id` field is
consistently blank on real data) — synced deals get `organizationId` and,
when the org has exactly one store, `storeId`, but never `ownerId`. Org- and
store-level dashboards (Owner, Manager) get real numbers; per-employee
(Consultant) numbers stay driven by natively-created deals only, until the
external CRM starts tracking assignment.
"""

import logging

from pymongo import UpdateOne

from app.memory.mongo_client import get_db
from app.tools import crm_deal_tool

logger = logging.getLogger(__name__)

# "value", not "monetary_value" — see crm_deal_tool._LIST_DEFAULT_FIELDS's
# comment for the external API quirk this works around; the response still
# comes back keyed as "monetary_value" either way.
_SYNC_FIELDS = ["name", "value", "deal_status", "expected_closing_date", "stage_id", "pipeline_id"]
_PAGE_SIZE = 100
_MAX_PAGES = 50


def _map_deal_status(raw: str | None) -> str:
    normalized = (raw or "").lower()
    if "won" in normalized:
        return "won"
    if "lost" in normalized:
        return "lost"
    return "open"


def _default_store_id(organization_id: str) -> str | None:
    """Only safe to auto-assign when the org has exactly one store — with
    more than one, the external CRM gives no signal for which store a deal
    belongs to, so it's left unset rather than guessed."""
    stores = list(get_db().stores.find({"organizationId": organization_id}, {"_id": 1}).limit(2))
    return str(stores[0]["_id"]) if len(stores) == 1 else None


def _to_native_update(organization_id: str, store_id: str | None, raw: dict) -> UpdateOne | None:
    external_id = raw.get("id")
    if not external_id:
        return None
    fields = {
        "organizationId": organization_id,
        "externalId": str(external_id),
        "name": raw.get("name") or "Untitled deal",
        "dealStatus": _map_deal_status(raw.get("deal_status")),
        "monetaryValue": raw.get("monetary_value") or 0,
        "expectedClosingDate": (raw.get("expected_closing_date") or "")[:10] or None,
        "stageId": raw.get("stage_id"),
        "pipelineId": raw.get("pipeline_id"),
    }
    if store_id:
        fields["storeId"] = store_id
    return UpdateOne(
        {"organizationId": organization_id, "externalId": str(external_id)},
        {"$set": fields},
        upsert=True,
    )


def sync_deals_for_org(organization_id: str) -> int:
    store_id = _default_store_id(organization_id)
    db = get_db()
    synced = 0

    for page in range(_MAX_PAGES):
        body = crm_deal_tool._fetch_raw_deals(
            offset=page * _PAGE_SIZE,
            page_limit=_PAGE_SIZE,
            fields=_SYNC_FIELDS,
            organization_id=organization_id,
        )
        raw_deals = body.get("deal") or body.get("deals") or body.get("data") or []
        if not raw_deals:
            break

        operations = [op for op in (_to_native_update(organization_id, store_id, d) for d in raw_deals) if op]
        if operations:
            result = db.crm_deals.bulk_write(operations, ordered=False)
            synced += result.upserted_count + result.modified_count

        if len(raw_deals) < _PAGE_SIZE:
            break

    return synced


def sync_all_orgs() -> dict:
    """Only orgs with an external CRM connected need this — native-only orgs
    already have live data in crm_deals with nothing to mirror."""
    db = get_db()
    org_ids = db.integration_credentials.distinct("organizationId", {"provider": "crm"})

    summary: dict[str, int | str] = {}
    for organization_id in org_ids:
        try:
            summary[organization_id] = sync_deals_for_org(organization_id)
        except Exception:
            logger.exception("CRM deal Mongo-sync failed for org %s", organization_id)
            summary[organization_id] = "error"
    return summary
