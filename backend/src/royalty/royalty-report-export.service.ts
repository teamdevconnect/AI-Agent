import { Injectable } from '@nestjs/common';
import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { RoyaltyReportSummary } from './royalty-report.service';

export interface RoyaltyReportExportRow {
  item: string;
  value: string;
}

function money(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Mirrors crm/deals-export.service.ts's / finance/finance-export.service.ts's
// exact 4-method shape (json2csv for CSV, pdfkit for PDF, exceljs for Excel)
// — the same proven export pattern, applied to a single report's Executive
// Summary line items (label/value rows) instead of a list of records.
@Injectable()
export class RoyaltyReportExportService {
  buildRows(report: RoyaltyReportSummary): RoyaltyReportExportRow[] {
    const rows: RoyaltyReportExportRow[] = [
      { item: 'Total Quotes', value: String(report.totalQuotes) },
      { item: 'Total Not Accepted Quotes', value: String(report.totalNotAcceptedQuotes) },
      { item: 'Total Deals', value: String(report.totalDeals) },
      { item: 'Total Invoices', value: String(report.totalInvoices) },
      { item: 'Total Void Invoices', value: String(report.totalVoidInvoices) },
      { item: 'Value of Currently Voided Invoices', value: money(report.valueOfVoidedInvoices) },
      { item: 'Value of Work In Progress', value: money(report.workInProgressValue) },
      { item: 'Gross Revenue', value: money(report.grossRevenue) },
      { item: 'Eligible Revenue', value: money(report.eligibleRevenue) },
      { item: 'Royalty Percentage', value: report.royaltyRule ? `${report.royaltyRule.royaltyPercentage}%` : '—' },
      { item: 'Royalty Fee (before cap)', value: money(report.royaltyFeeBeforeCap) },
      { item: 'Total Due', value: money(report.totalDue) },
      {
        item: 'Effective Royalty % (after cap)',
        value: report.effectiveRoyaltyPct !== null ? `${report.effectiveRoyaltyPct}%` : '—',
      },
    ];
    if (report.adminFeeAmount !== null) rows.push({ item: 'Admin Fee', value: money(report.adminFeeAmount) });
    if (report.techFeeAmount !== null) rows.push({ item: 'Tech Fee', value: money(report.techFeeAmount) });
    if (report.marketingFeeAmount !== null) rows.push({ item: 'Marketing Fee', value: money(report.marketingFeeAmount) });
    return rows;
  }

  toCsv(rows: RoyaltyReportExportRow[]): string {
    const parser = new Parser({ fields: ['item', 'value'] });
    return parser.parse(rows);
  }

  writePdf(doc: PDFKit.PDFDocument, rows: RoyaltyReportExportRow[], meta: { dateFrom: string; dateTo: string }): void {
    doc.fontSize(18).text('Royalty Report', { align: 'left' });
    doc.fontSize(10).fillColor('#666').text(`Period: ${meta.dateFrom} – ${meta.dateTo}`);
    doc.fontSize(8).fillColor('#999').text(`Report run: ${new Date().toISOString().slice(0, 10)}`);
    doc.moveDown();

    doc.fontSize(13).fillColor('#000').text('Executive Summary');
    doc.moveDown(0.3);
    for (const row of rows) {
      doc
        .fontSize(10)
        .fillColor('#000')
        .text(row.item, { continued: true, width: 300 })
        .fillColor('#333')
        .text(`  ${row.value}`);
    }
  }

  // Four sheets — Executive Summary (label/value, as CSV/PDF also show),
  // Deals, Invoices, and Work In Progress (Quotes) — the itemized line data
  // the summary's counts/sums are aggregated from, each ending in its own
  // Summary row (record count + Total Sales Ex Tax). Excel's native multi-
  // sheet support is the natural fit for this, unlike CSV/PDF which stay
  // Executive-Summary-only this pass (a scoped decision, not an oversight).
  async toExcel(rows: RoyaltyReportExportRow[], report: RoyaltyReportSummary): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet('Executive Summary');
    summarySheet.addRow(['Royalty Report']);
    summarySheet.addRow([`Period: ${report.dateFrom} – ${report.dateTo}`]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Item', 'Value']);
    for (const row of rows) {
      summarySheet.addRow([row.item, row.value]);
    }
    summarySheet.getColumn(1).width = 32;
    summarySheet.getColumn(2).width = 22;

    const dealsSheet = workbook.addWorksheet('Deals');
    dealsSheet.addRow(['Customer', 'Quote #', 'Status', 'Value', 'Closing Date', 'Created Date']);
    for (const d of report.deals) {
      dealsSheet.addRow([d.customerName, d.quoteNumber ?? '—', d.dealStatus, d.value, d.closingDate ?? '—', d.createdDate]);
    }
    dealsSheet.addRow([]);
    dealsSheet.addRow(['Summary']);
    dealsSheet.addRow(['Total Records', report.dealsSummary.totalRecords]);
    dealsSheet.addRow(['Total Sales (Ex Tax)', report.dealsSummary.totalSalesExTax]);
    for (let i = 1; i <= 6; i++) dealsSheet.getColumn(i).width = 22;

    const invoicesSheet = workbook.addWorksheet('Invoices');
    invoicesSheet.addRow([
      'Invoice #',
      'Customer',
      'Quote #',
      'Invoice Date',
      'Created Date',
      'Previous Value',
      'Updated Value',
      'Ex Tax Value',
      'Eligible Value',
      'Royalty',
      'Status',
      'Voided',
    ]);
    for (const inv of report.invoices) {
      invoicesSheet.addRow([
        inv.invoiceNumber,
        inv.customerName,
        inv.quoteNumber ?? '—',
        inv.invoiceDate,
        inv.createdDate,
        inv.previousValue ?? '—',
        inv.currentValue,
        inv.exTaxValue,
        inv.eligibleValue,
        inv.royalty,
        inv.invoiceStatus,
        inv.voidStatus ? 'Yes' : 'No',
      ]);
    }
    invoicesSheet.addRow([]);
    invoicesSheet.addRow(['Summary']);
    invoicesSheet.addRow(['Total Records', report.invoicesSummary.totalRecords]);
    invoicesSheet.addRow(['Total Sales (Ex Tax)', report.invoicesSummary.totalSalesExTax]);
    for (let i = 1; i <= 12; i++) invoicesSheet.getColumn(i).width = 16;

    const wipSheet = workbook.addWorksheet('Work In Progress');
    wipSheet.addRow(['Quote #', 'Customer', 'Created Date', 'Quote Total (Ex Tax)', 'Tax']);
    for (const q of report.wipQuotes) {
      wipSheet.addRow([q.quoteNumber ?? '—', q.customerName, q.createdDate, q.quoteTotalExTax, q.tax ?? '—']);
    }
    wipSheet.addRow([]);
    wipSheet.addRow(['Summary']);
    wipSheet.addRow(['Total Records', report.wipQuotesSummary.totalRecords]);
    wipSheet.addRow(['Total Sales (Ex Tax)', report.wipQuotesSummary.totalSalesExTax]);
    for (let i = 1; i <= 5; i++) wipSheet.getColumn(i).width = 22;

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
