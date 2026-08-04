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
from datetime import datetime, timezone

from pymongo import UpdateOne

from app.memory.mongo_client import get_db
from app.tools import crm_deal_tool, crm_quote_tool

logger = logging.getLogger(__name__)

# Fields whose change genuinely represents real business activity — used to
# decide whether to bump lastActivityAt (see the comment on that field
# below). Deliberately excludes things like a re-fetched but byte-identical
# clientDetails object; only the fields customer-activity.service.ts's
# "actioned today" logic actually cares about.
_DEAL_ACTIVITY_FIELDS = ("dealStatus", "monetaryValue", "expectedClosingDate", "stageId")
_QUOTE_ACTIVITY_FIELDS = ("quoteStatus", "clientApprovalStatus", "quoteAmount", "quoteNumber")

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


def _to_native_update(organization_id: str, store_id: str | None, raw: dict, existing_by_external_id: dict[str, dict]) -> UpdateOne | None:
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

    # This sync writes via raw pymongo, bypassing Mongoose entirely — its
    # {timestamps: true} plugin (and the updatedAt bump it normally provides
    # on every write) never fires here. Blindly stamping "now" on every
    # 10-minute poll would make every synced deal look "actioned today"
    # forever, which is worse than not tracking it at all (customer-activity.
    # service.ts's whole point is distinguishing real activity from noise).
    # So: only bump lastActivityAt when a field a human/CRM change would
    # actually affect has genuinely changed value, or the record is brand
    # new — never on a no-op re-sync of unchanged data.
    existing = existing_by_external_id.get(str(external_id))
    changed = existing is None or any(existing.get(f) != fields.get(f) for f in _DEAL_ACTIVITY_FIELDS)
    if changed:
        fields["lastActivityAt"] = datetime.now(timezone.utc)

    # $setOnInsert for createdAt — raw pymongo upserts otherwise never set it
    # at all (confirmed live: synced deals had no createdAt field whatsoever),
    # which would silently break customer-activity.service.ts's "New vs
    # Existing business" classification for every synced record. Using
    # $setOnInsert (not $set) means a later re-sync of the same deal never
    # overwrites the true first-seen moment.
    return UpdateOne(
        {"organizationId": organization_id, "externalId": str(external_id)},
        {"$set": fields, "$setOnInsert": {"createdAt": datetime.now(timezone.utc)}},
        upsert=True,
    )


def sync_deals_for_org(organization_id: str) -> int:
    store_id = _default_store_id(organization_id)
    db = get_db()
    synced = 0

    existing_by_external_id = {
        d["externalId"]: d
        for d in db.crm_deals.find(
            {"organizationId": organization_id, "externalId": {"$exists": True}},
            {"externalId": 1, **{f: 1 for f in _DEAL_ACTIVITY_FIELDS}},
        )
    }

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

        operations = [
            op for op in (_to_native_update(organization_id, store_id, d, existing_by_external_id) for d in raw_deals) if op
        ]
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


# Confirmed live against the real production org's ProspectConnect data:
# raw quote's "deal" is a nested object keyed "id" (not "_id"), e.g.
# {"id": "...", "name": "Noble hospital - Uniforms", "sales_person": "...",
# "team_id": ""}. Handle a bare id string too, defensively, in case a
# differently-shaped record ever appears.
def _extract_deal_id(raw: dict) -> str | None:
    deal_ref = raw.get("deal")
    if isinstance(deal_ref, dict):
        return deal_ref.get("id") or deal_ref.get("_id")
    if deal_ref:
        return str(deal_ref)
    return None


# Confirmed live: client_details carries a clean company_name (e.g. "Noble
# Hopsitals") and a real contact email (e.g. "hr@noblehospital.in") — a
# materially better business-name/correlation source than deriving one from
# Deal.name. Never fabricate a field that's genuinely blank in the source.
def _extract_client_details(raw: dict) -> dict | None:
    details = raw.get("client_details")
    if not isinstance(details, dict):
        return None
    out = {
        "companyName": details.get("company_name") or None,
        "contactName": details.get("name") or None,
        "email": details.get("email") or None,
        "phone": details.get("phone") or None,
    }
    out = {k: v for k, v in out.items() if v}
    return out or None


def _to_native_quote_update(
    organization_id: str,
    raw: dict,
    deal_native_id_by_external_id: dict[str, str],
    existing_by_external_id: dict[str, dict],
) -> UpdateOne | None:
    external_id = raw.get("_id")
    if not external_id:
        return None

    # The raw quote's "deal" reference is the EXTERNAL CRM's deal id, not a
    # native crm_deals._id (those are freshly generated on sync — see
    # sync_deals_for_org's UpdateOne, which keys deals on {organizationId,
    # externalId} and lets Mongo assign _id). Quote.dealId must reference the
    # native deal so customer-activity.service.ts's join actually works —
    # resolved here via the org's deal externalId->_id map built once per
    # sync run. A quote whose deal hasn't synced yet (or was deleted) simply
    # gets no dealId, never a dangling/wrong reference.
    raw_deal_id = _extract_deal_id(raw)
    deal_id = deal_native_id_by_external_id.get(raw_deal_id) if raw_deal_id else None
    ticket_number = raw.get("ticket_number")
    client_details = _extract_client_details(raw)
    # quote_owner is a nested profile object live (id/name/phone/email/
    # profile), not a bare id — Quote.quoteOwner is a plain string field
    # (matches Deal.ownerId's convention), so store just the id.
    owner_ref = raw.get("quote_owner")
    owner_id = owner_ref.get("id") if isinstance(owner_ref, dict) else owner_ref
    fields = {
        "organizationId": organization_id,
        "externalId": str(external_id),
        "quoteName": raw.get("quote_name") or "Untitled quote",
        "quoteStatus": raw.get("quote_status") or "draft",
        "clientApprovalStatus": raw.get("client_approval_status") or "pending",
        "quoteAmount": raw.get("quote_amount") or 0,
        "currency": raw.get("currency") or "USD",
        "expirationDate": (raw.get("expiration_date") or "")[:10] or None,
    }
    if owner_id:
        fields["quoteOwner"] = str(owner_id)
    if deal_id:
        fields["dealId"] = str(deal_id)
    # Never fabricate a quoteNumber when the external record has none —
    # an absent ticket_number leaves the field unset, shown as "—" by the
    # frontend rather than a made-up value.
    if ticket_number:
        fields["quoteNumber"] = str(ticket_number)
    if client_details:
        fields["clientDetails"] = client_details

    # Same reasoning as _to_native_update's lastActivityAt — raw pymongo
    # writes never trigger Mongoose's updatedAt, so only bump it on a real
    # content change (or first sync), never on every unchanged re-poll.
    existing = existing_by_external_id.get(str(external_id))
    changed = existing is None or any(existing.get(f) != fields.get(f) for f in _QUOTE_ACTIVITY_FIELDS)
    if changed:
        fields["lastActivityAt"] = datetime.now(timezone.utc)

    # Unlike deals (no creation-date field requested in _SYNC_FIELDS), a raw
    # quote carries its own real date_created — use that for createdAt
    # instead of "now" so a quote synced today that was actually created
    # weeks ago doesn't look brand new. Falls back to "now" only if the
    # external record genuinely has none.
    created_raw = raw.get("date_created")
    try:
        created_at = datetime.fromisoformat(created_raw.replace("Z", "+00:00")) if created_raw else datetime.now(timezone.utc)
    except ValueError:
        created_at = datetime.now(timezone.utc)

    return UpdateOne(
        {"organizationId": organization_id, "externalId": str(external_id)},
        {"$set": fields, "$setOnInsert": {"createdAt": created_at}},
        upsert=True,
    )


def sync_quotes_for_org(organization_id: str) -> int:
    db = get_db()
    synced = 0
    start_after = 0
    page_size = 100

    # Built once per run (not once per quote) — cheap relative to the paged
    # ProspectConnect calls this function already makes, and re-fetching it
    # per-quote would be needless N+1 Mongo round trips.
    deal_native_id_by_external_id = {
        d["externalId"]: str(d["_id"])
        for d in db.crm_deals.find({"organizationId": organization_id, "externalId": {"$exists": True}}, {"externalId": 1})
    }
    existing_by_external_id = {
        q["externalId"]: q
        for q in db.crm_quotes.find(
            {"organizationId": organization_id, "externalId": {"$exists": True}},
            {"externalId": 1, **{f: 1 for f in _QUOTE_ACTIVITY_FIELDS}},
        )
    }

    for _ in range(_MAX_PAGES):
        body = crm_quote_tool._fetch_raw_quotes(
            limit=page_size, start_after=start_after, organization_id=organization_id,
        )
        raw_quotes = body.get("quotes") or []
        if not raw_quotes:
            break

        operations = [
            op
            for op in (
                _to_native_quote_update(organization_id, q, deal_native_id_by_external_id, existing_by_external_id)
                for q in raw_quotes
            )
            if op
        ]
        if operations:
            result = db.crm_quotes.bulk_write(operations, ordered=False)
            synced += result.upserted_count + result.modified_count

        if len(raw_quotes) < page_size:
            break
        start_after += page_size

    return synced


def sync_all_quote_orgs() -> dict:
    """Same org-selection rule as sync_all_orgs — only external-CRM-connected
    orgs need mirroring; a failure syncing one org's quotes must never abort
    another org's."""
    db = get_db()
    org_ids = db.integration_credentials.distinct("organizationId", {"provider": "crm"})

    summary: dict[str, int | str] = {}
    for organization_id in org_ids:
        try:
            summary[organization_id] = sync_quotes_for_org(organization_id)
        except Exception:
            logger.exception("CRM quote Mongo-sync failed for org %s", organization_id)
            summary[organization_id] = "error"
    return summary
