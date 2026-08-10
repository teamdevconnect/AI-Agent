import { FilterQuery } from 'mongoose';
import { Deal } from './schemas/deal.schema';
import { DealFilterQueryDto } from './dto/deal-filter-query.dto';

// Single place the Mongo match stage gets built from a DealFilterQueryDto —
// reused by deals.service.ts's listFiltered/listForExport and
// deal-performance-dashboard.service.ts's aggregations, so filter semantics
// can never drift between the list/export/dashboard paths.
//
// `includeDateRange: false` is used by trend widgets that generate their
// own date-bucketed axis (e.g. wonLostTrend) — those apply their own period
// window on top of this match rather than the user's dateFrom/dateTo.
export function buildDealMatchStage(
  organizationId: string,
  filters: DealFilterQueryDto,
  storeConstraint?: string,
  options?: { includeDateRange?: boolean },
): FilterQuery<Deal> {
  const includeDateRange = options?.includeDateRange ?? true;
  const match: FilterQuery<Deal> = { organizationId };

  if (storeConstraint) {
    match.storeId = storeConstraint;
  } else if (filters.storeId?.length) {
    match.storeId = { $in: filters.storeId };
  }

  if (filters.ownerId?.length) match.ownerId = { $in: filters.ownerId };
  if (filters.dealStatus?.length) match.dealStatus = { $in: filters.dealStatus };
  if (filters.stageId?.length) match.stageId = { $in: filters.stageId };
  if (filters.leadSource?.length) match.leadSource = { $in: filters.leadSource };
  if (filters.product?.length) match.product = { $in: filters.product };
  if (filters.customerType?.length) match.customerType = { $in: filters.customerType };
  if (filters.region?.length) match.region = { $in: filters.region };

  // Real user-reported bug, fixed here: was expectedClosingDate (a forecast
  // field — "when will this revenue land"), which made a deal created today
  // with a next-month expected close date invisible to a "this month"
  // filter — reads as broken, not as intended forecast behavior. Filters
  // on createdAt instead — "did I create/touch this record in this
  // window" — matching Quote's own equivalent filtering, which was already
  // correctly createdAt-based. dateFrom/dateTo are plain "YYYY-MM-DD"
  // strings; dateTo is pushed to end-of-day so a date-only value doesn't
  // mean midnight and silently exclude that entire day's own records.
  if (includeDateRange && (filters.dateFrom || filters.dateTo)) {
    match.createdAt = {
      ...(filters.dateFrom ? { $gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { $lte: new Date(new Date(filters.dateTo).setHours(23, 59, 59, 999)) } : {}),
    };
  }

  if (filters.valueMin !== undefined || filters.valueMax !== undefined) {
    match.monetaryValue = {
      ...(filters.valueMin !== undefined ? { $gte: filters.valueMin } : {}),
      ...(filters.valueMax !== undefined ? { $lte: filters.valueMax } : {}),
    };
  }

  return match;
}
