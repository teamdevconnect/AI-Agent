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

  if (includeDateRange && (filters.dateFrom || filters.dateTo)) {
    match.expectedClosingDate = {
      ...(filters.dateFrom ? { $gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { $lte: filters.dateTo } : {}),
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
