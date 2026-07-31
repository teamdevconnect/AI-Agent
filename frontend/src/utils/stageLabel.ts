// Native deals get human-typed stage names ("proposal", "negotiation"), but
// deals synced from an external CRM (crm_mongo_sync.py) carry that CRM's own
// opaque internal stage id — confirmed live against real production data to
// look like `<pipelineId>_stage_<uuid>` (e.g.
// "694baae22365c712b3e1afd2_stage_e3110b37-0168-499e-b306-c4d310f8de36"),
// not a bare hex string. There's no Pipeline/Stage name-mapping schema
// anywhere to resolve it to something readable. Rather than show that raw
// id everywhere it appears, detect the opaque-id shape (a UUID segment, or
// any long hex run — covers bare Mongo ObjectIds too) and render a short,
// stable, non-jarring placeholder instead. Shared across deal-performance
// and business-dashboard — both render `Deal.stageId`/`DealSummary.stageId`.
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const LONG_HEX_RUN = /[0-9a-f]{16,}/i;

export function isOpaqueStageId(stageId: string): boolean {
  return UUID_PATTERN.test(stageId) || LONG_HEX_RUN.test(stageId);
}

export function formatStageLabel(stageId: string): string {
  return isOpaqueStageId(stageId) ? `Stage •${stageId.slice(-4).toUpperCase()}` : stageId;
}
