import { axiosClient } from '@/api/axiosClient';

export type GrossMarginGroupBy = 'salesCustomer' | 'salesUser' | 'quotesCustomer' | 'quotesUser';

export interface GrossMarginReportGroupRow {
  groupKey: string;
  groupLabel: string;
  totalCost: number;
  totalIncome: number;
  marginAmount: number;
  marginPct: number;
}

export interface GrossMarginReportSummary {
  dateFrom: string;
  dateTo: string;
  groupBy: GrossMarginGroupBy;
  hasCostData: boolean;
  totalInvoicesInRange: number;
  invoicesWithCost: number;
  coveragePct: number;
  totalCost: number;
  totalIncome: number;
  marginAmount: number;
  marginPct: number;
  groups: GrossMarginReportGroupRow[];
  note: string;
}

// Computed from Invoice.costAmount — a manually-entered field (see the
// Royalty Invoices edit form's own "Cost" input). hasCostData is only true
// once at least one invoice in the selected range has a Cost entered;
// otherwise the UI shows `note` as an honest empty state rather than a
// fabricated $0.00/100% table. "Quotes" groupings always report
// hasCostData: false — Quote has no cost concept anywhere in this system.
export const grossMarginReportService = {
  async generate(dateFrom: string, dateTo: string, groupBy: GrossMarginGroupBy): Promise<GrossMarginReportSummary> {
    const { data } = await axiosClient.get<GrossMarginReportSummary>('/reporting/gross-margin', {
      params: { dateFrom, dateTo, groupBy },
    });
    return data;
  },
};
