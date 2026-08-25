import { axiosClient } from '@/api/axiosClient';

export interface SalesReportGroupRow {
  groupKey: string;
  groupLabel: string;
  totalSalesExTax: number;
  percentOfSales: number;
}

export interface SalesReportSummary {
  dateFrom: string;
  dateTo: string;
  groupBy: 'customer' | 'user' | 'quoteOwner';
  totalSalesForPeriod: number;
  groups: SalesReportGroupRow[];
  dataSourceNote: string;
}

// Computed from real won-deal revenue — no per-item product/decoration cost
// breakdown exists anywhere in this system, so unlike the reference report
// this only shows one combined "Total Sales" figure (see the service's own
// dataSourceNote for the live caveat on "Quote Owner" grouping).
export const salesReportService = {
  async generate(dateFrom: string, dateTo: string, groupBy: 'customer' | 'user' | 'quoteOwner'): Promise<SalesReportSummary> {
    const { data } = await axiosClient.get<SalesReportSummary>('/reporting/sales', { params: { dateFrom, dateTo, groupBy } });
    return data;
  },
};
