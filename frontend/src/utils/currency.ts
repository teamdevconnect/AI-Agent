// Sales targets/deals are always INR for this deployment (see
// backend/src/crm/schemas/sales-target.schema.ts's default) — 'en-IN' gives
// the correct lakh/crore digit grouping, not just the ₹ symbol.
export function formatINR(value: number | null): string {
  if (value === null) return '—';
  return `₹${value.toLocaleString('en-IN')}`;
}

// Haive Credits billing (packages/payments) is NOT hardcoded to INR (see
// backend/src/config/configuration.ts's billing.currency) — this formats
// whatever currency code a given package/payment record actually carries,
// unlike formatINR above which is deliberately fixed to one currency for
// the unrelated sales/deals domain.
const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export function formatCurrency(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()];
  const formattedAmount = amount.toLocaleString();
  return symbol ? `${symbol}${formattedAmount}` : `${formattedAmount} ${currency.toUpperCase()}`;
}
