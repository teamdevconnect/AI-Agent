// Converts a "YYYY-MM" period string into a half-open [start, end) UTC Date
// range, for querying real Date-typed fields (Quote/EmailIntelligenceItem
// createdAt/receivedAt, etc.). Deal.expectedClosingDate is a plain
// "YYYY-MM-DD" string field, not a Date — it deliberately keeps using its
// own existing `{$regex: '^'+period}` prefix match everywhere (see
// SalesAnalyticsService/DealPerformanceDashboardService) rather than this
// utility, to avoid a second, inconsistent Deal-date semantic.
export function periodToDateRange(period: string): { start: Date; end: Date } {
  const [year, month] = period.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
  };
}

export function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}
