// Sales targets/deals are always INR for this deployment (see
// backend/src/crm/schemas/sales-target.schema.ts's default) — 'en-IN' gives
// the correct lakh/crore digit grouping, not just the ₹ symbol.
export function formatINR(value: number | null): string {
  if (value === null) return '—';
  return `₹${value.toLocaleString('en-IN')}`;
}
