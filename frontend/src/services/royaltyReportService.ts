import { axiosClient } from '@/api/axiosClient';

export interface RoyaltyReportDealLine {
  dealId: string;
  customerName: string;
  businessNameSource: 'quote_client_details' | 'deal_name';
  quoteNumber?: string;
  dealStatus: 'open' | 'won' | 'lost';
  value: number;
  closingDate?: string;
  createdDate: string;
}

export interface RoyaltyReportInvoiceLine {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  quoteNumber?: string;
  invoiceDate: string;
  createdDate: string;
  previousValue?: number;
  currentValue: number;
  exTaxValue: number;
  eligibleValue: number;
  royalty: number;
  invoiceStatus: string;
  voidStatus: boolean;
}

export interface RoyaltyReportWipQuoteLine {
  quoteId: string;
  quoteNumber?: string;
  customerName: string;
  createdDate: string;
  quoteTotalExTax: number;
  tax: number | null;
}

export interface RoyaltyReportLineSummary {
  totalRecords: number;
  totalSalesExTax: number;
}

export interface RoyaltyReportGroupRow {
  groupKey: string;
  groupLabel: string;
  totalSalesExTax: number;
  percentOfSales: number;
  royaltyDue: number;
}

export interface RoyaltyReportSummary {
  dateFrom: string;
  dateTo: string;
  scope: { level: 'org' | 'store'; storeId?: string };
  royaltyRule: {
    royaltyPercentage: number;
    capType: 'none' | 'min' | 'max' | 'sliding';
    capValue?: number;
    effectiveDate: string;
  } | null;
  totalQuotes: number;
  totalNotAcceptedQuotes: number;
  totalDeals: number;
  totalInvoices: number;
  totalVoidInvoices: number;
  valueOfVoidedInvoices: number;
  workInProgressValue: number;
  grossRevenue: number;
  eligibleRevenue: number;
  royaltyFeeBeforeCap: number;
  totalDue: number;
  effectiveRoyaltyPct: number | null;
  marketingFeeAmount: number | null;
  otherFeeAmount: number | null;
  dataSourceNote: string;
  deals: RoyaltyReportDealLine[];
  dealsSummary: RoyaltyReportLineSummary;
  invoices: RoyaltyReportInvoiceLine[];
  invoicesSummary: RoyaltyReportLineSummary;
  wipQuotes: RoyaltyReportWipQuoteLine[];
  wipQuotesSummary: RoyaltyReportLineSummary;
  groupBy: 'salesperson' | 'customer' | null;
  groupedBreakdown: RoyaltyReportGroupRow[];
}

// Computed automatically from real Deal/Quote/Invoice data on the backend —
// no manual invoice entry is required to generate a report (see
// royalty-report.service.ts's own comment for why Deal revenue is the
// primary source today). Takes an arbitrary [dateFrom, dateTo] range, not
// just a calendar month — DateRangeControl's own "This Month" preset covers
// the whole-month case, "Custom" covers any other start/end date pair.
export const royaltyReportService = {
  async generate(
    dateFrom: string,
    dateTo: string,
    groupBy?: 'salesperson' | 'customer',
  ): Promise<RoyaltyReportSummary> {
    const { data } = await axiosClient.get<RoyaltyReportSummary>('/royalty/report', {
      params: { dateFrom, dateTo, ...(groupBy ? { groupBy } : {}) },
    });
    return data;
  },

  // Same blob-download pattern as financeDocumentsService.downloadExport —
  // requires the same bearer auth as every other endpoint, so a plain
  // <a href> can't be used directly.
  async downloadExport(format: 'csv' | 'xlsx' | 'pdf', dateFrom: string, dateTo: string): Promise<void> {
    const response = await axiosClient.get('/royalty/report/export', {
      params: { dateFrom, dateTo, format },
      responseType: 'blob',
    });
    const disposition = response.headers['content-disposition'] as string | undefined;
    const filename = disposition ? /filename="([^"]+)"/.exec(disposition)?.[1] : undefined;
    const url = URL.createObjectURL(response.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename ?? `royalty-report-${dateFrom}_to_${dateTo}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
