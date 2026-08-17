import { FilterQuery } from 'mongoose';
import { Invoice } from './schemas/invoice.schema';
import { InvoiceFilterQueryDto } from './dto/invoice-filter-query.dto';

// Single place the Mongo match stage gets built from an InvoiceFilterQueryDto
// — mirrors crm/deal-filter.util.ts's buildDealMatchStage shape, reused by
// InvoicesService.listFiltered today and by the future Phase 20b report
// engine's Section 1/2/3 queries, so filter semantics can never drift
// between the list and report paths.
export function buildInvoiceMatchStage(
  organizationId: string,
  filters: InvoiceFilterQueryDto,
  storeConstraint?: string,
): FilterQuery<Invoice> {
  const match: FilterQuery<Invoice> = { organizationId };

  if (storeConstraint) {
    match.storeId = storeConstraint;
  } else if (filters.storeId?.length) {
    match.storeId = { $in: filters.storeId };
  }

  if (filters.salespersonId?.length) match.salespersonId = { $in: filters.salespersonId };
  if (filters.invoiceStatus?.length) match.invoiceStatus = { $in: filters.invoiceStatus };
  if (filters.voidStatus !== undefined) match.voidStatus = filters.voidStatus;
  if (filters.source) match.source = filters.source;

  if (filters.customerName?.trim()) {
    const escaped = filters.customerName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'i');
    match.$or = [{ 'clientDetails.companyName': re }, { 'clientDetails.contactName': re }];
  }

  // invoiceDate is a real Date field (unlike Deal's string-based
  // expectedClosingDate) — dateTo is pushed to end-of-day so a date-only
  // value doesn't mean midnight and silently exclude that entire day's own
  // invoices, matching deal-filter.util.ts's identical convention. Explicit
  // 'Z' (UTC), not `.setHours()` — that mutates in the server process's
  // local timezone, which drifts hours off this boundary on any server not
  // running in UTC.
  if (filters.dateFrom || filters.dateTo) {
    match.invoiceDate = {
      ...(filters.dateFrom ? { $gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { $lte: new Date(`${filters.dateTo}T23:59:59.999Z`) } : {}),
    };
  }

  return match;
}
