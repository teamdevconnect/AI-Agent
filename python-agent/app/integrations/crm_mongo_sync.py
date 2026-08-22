"""Mirrors an org's connected EXTERNAL CRM deals into the native `crm_deals`
Mongo collection (same collection/field names backend/src/crm/schemas/deal.schema.ts
and business-dashboard.service.ts already read) — this is what makes the
Owner/Manager/Consultant dashboards show real numbers for orgs that use an
external CRM instead of the native one, without changing a line of NestJS.

Deliberately separate from app.rag.business_sync (which indexes CRM data into
Qdrant for semantic search, is not org-aware, and never touches these
collections) — different concern, different write target.

Deal-owner mapping: ProspectConnect DOES carry a per-salesperson assignment
on a deal — the raw `sales_person` field (confirmed live against production
data), not `team_id` (which is indeed always blank on real data, and was
previously mistaken for the only assignment signal this CRM exposes). Every
deal's raw `sales_person` id is mirrored into `externalOwnerRef` below
(provider-agnostic — see backend/src/crm/schemas/deal.schema.ts's own
comment). It is a foreign id space belonging to ProspectConnect, not this
app's own User._id, so it can only become a trustworthy native `ownerId` via
an admin-configured mapping (backend/src/crm/schemas/deal-owner-mapping.schema.ts,
resolved here at sync time via `crm_deal_owner_mappings`). Deals whose
`sales_person` has no mapping yet keep whatever `ownerId` they already had
(never wiped) until an admin maps that salesperson in Settings → Deal
Assignment.

That mapping UI needs a human-readable label for each raw sales_person id,
but the deals endpoint only ever returns a bare id (confirmed live) — never
a name. The quotes endpoint DOES return one (quote_owner is a nested
{id, name, ...} object) for the same underlying CRM user id space, so
sync_deals_for_org cross-references this org's already-synced
Quote.quoteOwnerLabel values onto Deal.externalOwnerLabel. Real data either
way — never fabricated — just sourced from wherever the CRM actually exposes
it.
"""

import logging
from datetime import datetime, timezone

from bson import ObjectId
from pymongo import ReturnDocument, UpdateOne

from app.memory.mongo_client import get_db
from app.tools import crm_deal_tool, crm_quote_tool

logger = logging.getLogger(__name__)

# Fields whose change genuinely represents real business activity — used to
# decide whether to bump lastActivityAt (see the comment on that field
# below). Deliberately excludes things like a re-fetched but byte-identical
# clientDetails object; only the fields customer-activity.service.ts's
# "actioned today" logic actually cares about. externalOwnerRef is included —
# a reassigned salesperson is real activity too.
_DEAL_ACTIVITY_FIELDS = ("dealStatus", "monetaryValue", "expectedClosingDate", "stageId", "externalOwnerRef")
_QUOTE_ACTIVITY_FIELDS = ("quoteStatus", "clientApprovalStatus", "quoteAmount", "quoteNumber")

# "value", not "monetary_value" — see crm_deal_tool._LIST_DEFAULT_FIELDS's
# comment for the external API quirk this works around; the response still
# comes back keyed as "monetary_value" either way. "sales_person" is the raw
# per-deal owner id (confirmed live) — see this module's own docstring on why
# "team_id" was previously (wrongly) assumed to be the only signal.
_SYNC_FIELDS = ["name", "value", "deal_status", "expected_closing_date", "stage_id", "pipeline_id", "sales_person"]
_PAGE_SIZE = 100
_MAX_PAGES = 50
_OWNER_PROVIDER = "prospectconnect"


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


def _to_native_update(
    organization_id: str,
    store_id: str | None,
    raw: dict,
    existing_by_external_id: dict[str, dict],
    owner_mapping_by_ref: dict[str, str],
    owner_label_by_ref: dict[str, str],
) -> UpdateOne | None:
    external_id = raw.get("id")
    if not external_id:
        return None
    existing = existing_by_external_id.get(str(external_id))
    new_status = _map_deal_status(raw.get("deal_status"))
    raw_expected_closing = (raw.get("expected_closing_date") or "")[:10] or None
    fields = {
        "organizationId": organization_id,
        "externalId": str(external_id),
        "name": raw.get("name") or "Untitled deal",
        "dealStatus": new_status,
        "monetaryValue": raw.get("monetary_value") or 0,
        "expectedClosingDate": raw_expected_closing,
        "stageId": raw.get("stage_id"),
        "pipelineId": raw.get("pipeline_id"),
    }
    if store_id:
        fields["storeId"] = store_id

    # Real bug, fixed here: mirrors deals.service.ts's own update() logic
    # for natively-edited deals (auto-stamps expectedClosingDate to today on
    # a won/lost transition, unless the caller already sent an explicit new
    # date) — analytics-dashboard.service.ts attributes "Won Deals"/revenue
    # to whichever month a deal's expectedClosingDate falls in, so a stale
    # date silently misattributes real won revenue to the wrong month.
    # ProspectConnect's "expected closing date" is a forecast set once when
    # the deal was created/quoted — confirmed live it is NOT retroactively
    # updated when a deal is later marked won there (16 of this org's 19 won
    # deals still carried a pre-win forecast date, misattributing ~₹613k of
    # real won revenue away from the months those deals actually won in).
    # Only stamps "today" on a genuine open->won/lost TRANSITION detected
    # this poll (never on an already-won deal's routine re-sync — that would
    # perpetually reset its date on every 10-minute poll instead), and only
    # when ProspectConnect itself didn't also send a fresh date in this same
    # payload — an explicit CRM-provided date is always respected.
    if (
        existing is not None
        and existing.get("dealStatus") != new_status
        and new_status in ("won", "lost")
        and existing.get("expectedClosingDate") == raw_expected_closing
    ):
        fields["expectedClosingDate"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # sales_person is a raw ProspectConnect user id, not a native User._id —
    # always mirrored as-is so it's visible in Settings → Deal Assignment's
    # mapping UI even before an admin maps it. ownerId itself is only ever
    # set here when a real admin-configured mapping already resolves this
    # exact ref (deal-owner-mapping.service.ts's upsertMapping applies to
    # already-synced deals immediately; this covers deals synced/re-synced
    # AFTER a mapping already exists). No mapping yet -> ownerId is left
    # untouched, never wiped, so a prior manual per-deal assignment survives.
    sales_person = raw.get("sales_person")
    if sales_person:
        fields["externalOwnerRef"] = str(sales_person)
        fields["externalOwnerProvider"] = _OWNER_PROVIDER
        # The deal endpoint never returns a name for sales_person (confirmed
        # live — always a bare id), but the SAME ProspectConnect user id also
        # shows up as quote_owner.id on this org's quotes, which DOES carry a
        # real name (see _to_native_quote_update). owner_label_by_ref is built
        # from whatever quotes have already synced — only ever a real label
        # actually seen from the CRM, never guessed, and left unset (falling
        # back to the raw ref in the UI) until a matching quote has synced.
        label = owner_label_by_ref.get(str(sales_person))
        if label:
            fields["externalOwnerLabel"] = label
        mapped_owner_id = owner_mapping_by_ref.get(str(sales_person))
        if mapped_owner_id:
            fields["ownerId"] = mapped_owner_id

    # This sync writes via raw pymongo, bypassing Mongoose entirely — its
    # {timestamps: true} plugin (and the updatedAt bump it normally provides
    # on every write) never fires here. Blindly stamping "now" on every
    # 10-minute poll would make every synced deal look "actioned today"
    # forever, which is worse than not tracking it at all (customer-activity.
    # service.ts's whole point is distinguishing real activity from noise).
    # So: only bump lastActivityAt when a field a human/CRM change would
    # actually affect has genuinely changed value, or the record is brand
    # new — never on a no-op re-sync of unchanged data. (existing already
    # resolved above, reused here rather than looked up twice.)
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
    # Built once per run — see deal-owner-mapping.service.ts for the write
    # side (admin maps a salesperson, service bulk-applies to already-synced
    # deals immediately); this is the read side that keeps NEWLY/RE-synced
    # deals resolved too, without a second admin action per poll.
    owner_mapping_by_ref = {
        m["externalOwnerRef"]: m["ownerId"]
        for m in db.crm_deal_owner_mappings.find(
            {"organizationId": organization_id, "provider": _OWNER_PROVIDER},
            {"externalOwnerRef": 1, "ownerId": 1},
        )
    }
    # Cross-referenced from this org's already-synced quotes (see
    # _to_native_quote_update) — the deals endpoint itself never returns a
    # name for sales_person, but the same CRM user id shows up as
    # quote_owner.id on quotes, which does carry one. Empty on an org's very
    # first-ever sync (before any quote has synced yet); self-heals on a
    # later poll once sync_quotes_for_org has run at least once.
    owner_label_by_ref = {
        q["quoteOwner"]: q["quoteOwnerLabel"]
        for q in db.crm_quotes.find(
            {"organizationId": organization_id, "quoteOwner": {"$exists": True}, "quoteOwnerLabel": {"$exists": True, "$ne": None}},
            {"quoteOwner": 1, "quoteOwnerLabel": 1},
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
            op
            for op in (
                _to_native_update(organization_id, store_id, d, existing_by_external_id, owner_mapping_by_ref, owner_label_by_ref)
                for d in raw_deals
            )
            if op
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
    # (matches Deal.ownerId's convention), so store just the id. The name
    # alongside it is real, CRM-provided data (never guessed) — captured into
    # quoteOwnerLabel so sync_deals_for_org can cross-reference it onto
    # Deal.externalOwnerLabel for the same CRM user id (see that function's
    # own comment on why deals alone can't get a label directly).
    owner_ref = raw.get("quote_owner")
    owner_id = owner_ref.get("id") if isinstance(owner_ref, dict) else owner_ref
    owner_label = owner_ref.get("name") if isinstance(owner_ref, dict) else None
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
    if owner_label:
        fields["quoteOwnerLabel"] = str(owner_label)
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

    # Phase 20a — collected while iterating the OLD (pre-sync) state above,
    # so this only ever fires on a genuine clientApprovalStatus transition
    # into 'approved', never on a quote that stays approved across the next
    # poll (see _draft_invoice_for_approved_quote's own docstring).
    newly_approved_external_ids: list[str] = []

    for _ in range(_MAX_PAGES):
        body = crm_quote_tool._fetch_raw_quotes(
            limit=page_size, start_after=start_after, organization_id=organization_id,
        )
        raw_quotes = body.get("quotes") or []
        if not raw_quotes:
            break

        operations = []
        for raw_quote in raw_quotes:
            op = _to_native_quote_update(organization_id, raw_quote, deal_native_id_by_external_id, existing_by_external_id)
            if op:
                operations.append(op)

            external_id = raw_quote.get("_id")
            if not external_id:
                continue
            if (raw_quote.get("client_approval_status") or "pending") != "approved":
                continue
            existing = existing_by_external_id.get(str(external_id))
            if existing is None or existing.get("clientApprovalStatus") != "approved":
                newly_approved_external_ids.append(str(external_id))

        if operations:
            result = db.crm_quotes.bulk_write(operations, ordered=False)
            synced += result.upserted_count + result.modified_count

        if len(raw_quotes) < page_size:
            break
        start_after += page_size

    if newly_approved_external_ids:
        _draft_invoices_for_newly_approved(db, organization_id, newly_approved_external_ids)

    return synced


def _draft_invoice_for_approved_quote(db, organization_id: str, quote: dict) -> None:
    """Phase 20a's live production trigger for the Royalty Report Engine's
    Invoice entity — auto-drafts an Invoice the moment a Quote's
    clientApprovalStatus transitions to 'approved'. Mirrors
    backend/src/royalty/invoices.service.ts's createDraftFromQuote (built
    for a future native quote-approval path that doesn't exist yet — this
    function is the only real, live caller today). Carries over only real,
    known values — the quote's own accepted amount — never a fabricated
    figure; every invoice-specific field with no real source (GST, shipping,
    payment/void status) starts unset, filled in later by a human.
    """
    quote_id = str(quote["_id"])

    # Defensive dedupe on top of the transition-only trigger above and the
    # schema's own unique partial index on {organizationId, quoteId} — a
    # duplicated invoice directly inflates a real royalty-due dollar figure,
    # worth the extra guard (the same reasoning crm_mongo_sync.py already
    # applies to mailbox-dedup elsewhere in this codebase).
    if db.royalty_invoices.find_one({"organizationId": organization_id, "quoteId": quote_id}):
        return

    # storeId/salespersonId are only ever set when actually known via the
    # linked Deal — never guessed, same "only safe when known" rule
    # _default_store_id already applies to Deal syncing.
    deal = None
    deal_id = quote.get("dealId")
    if deal_id:
        try:
            deal = db.crm_deals.find_one({"_id": ObjectId(deal_id)})
        except Exception:
            deal = None

    counter = db.royalty_invoice_counters.find_one_and_update(
        {"organizationId": organization_id},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    invoice_number = f"INV-{counter['seq']:04d}"
    now = datetime.now(timezone.utc)
    quote_amount = quote.get("quoteAmount") or 0

    fields: dict = {
        "organizationId": organization_id,
        "quoteId": quote_id,
        "invoiceNumber": invoice_number,
        "invoiceDate": now,
        "originalValue": quote_amount,
        "currentValue": quote_amount,
        "currency": quote.get("currency") or "INR",
        "invoiceStatus": "draft",
        "voidStatus": False,
        "source": "auto_from_quote",
        "createdBy": "system:crm-sync",
        "createdAt": now,
        "updatedAt": now,
    }
    if deal:
        fields["dealId"] = str(deal["_id"])
        if deal.get("storeId"):
            fields["storeId"] = deal["storeId"]
        if deal.get("ownerId"):
            fields["salespersonId"] = deal["ownerId"]
    client_details = quote.get("clientDetails")
    if client_details:
        fields["clientDetails"] = client_details

    db.royalty_invoices.insert_one(fields)


def _draft_invoices_for_newly_approved(db, organization_id: str, external_ids: list[str]) -> None:
    # Wrapped per-quote — one malformed/unexpected quote must never abort
    # drafting for the rest, matching this file's existing per-org resilience
    # convention (see sync_all_orgs/sync_all_quote_orgs).
    quotes = db.crm_quotes.find({"organizationId": organization_id, "externalId": {"$in": external_ids}})
    for quote in quotes:
        try:
            _draft_invoice_for_approved_quote(db, organization_id, quote)
        except Exception:
            logger.exception(
                "Auto-draft invoice failed for quote externalId=%s org=%s",
                quote.get("externalId"),
                organization_id,
            )


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
