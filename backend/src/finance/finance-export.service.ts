import { Injectable } from '@nestjs/common';
import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { FinanceDocumentDocument } from './schemas/finance-document.schema';

export interface FinanceExportRow {
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentAmount: number;
  currency: string;
  paymentStatus: string;
  department: string;
  costCenter: string;
  expenseCategory: string;
  paymentMethod: string;
}

const STATUS_ORDER = ['pending', 'overdue', 'partially_paid', 'paid', 'cancelled'] as const;
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  overdue: 'Overdue',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

// Mirrors crm/deals-export.service.ts's structure exactly (json2csv for
// CSV, pdfkit for PDF, exceljs for Excel) — no new export pattern needed.
@Injectable()
export class FinanceExportService {
  buildRows(docs: FinanceDocumentDocument[]): FinanceExportRow[] {
    return docs.map((d) => ({
      vendorName: d.vendorName ?? 'Unknown vendor',
      invoiceNumber: d.invoiceNumber ?? '',
      invoiceDate: d.invoiceDate ?? '',
      dueDate: d.dueDate ?? '',
      paymentAmount: d.paymentAmount,
      currency: d.currency,
      paymentStatus: d.paymentStatus,
      department: d.department ?? '',
      costCenter: d.costCenter ?? '',
      expenseCategory: d.expenseCategory ?? '',
      paymentMethod: d.paymentMethod ?? '',
    }));
  }

  toCsv(rows: FinanceExportRow[]): string {
    const parser = new Parser({
      fields: [
        'vendorName',
        'invoiceNumber',
        'invoiceDate',
        'dueDate',
        'paymentAmount',
        'currency',
        'paymentStatus',
        'department',
        'costCenter',
        'expenseCategory',
        'paymentMethod',
      ],
    });
    return parser.parse(rows);
  }

  writePdf(doc: PDFKit.PDFDocument, rows: FinanceExportRow[], meta: { dateFrom?: string; dateTo?: string }): void {
    doc.fontSize(18).text('Finance Document Export', { align: 'left' });
    const range = meta.dateFrom
      ? meta.dateTo && meta.dateTo !== meta.dateFrom
        ? `${meta.dateFrom} – ${meta.dateTo}`
        : meta.dateFrom
      : 'All time';
    doc.fontSize(10).fillColor('#666').text(range);
    doc.moveDown();

    const byStatus: Record<string, FinanceExportRow[]> = { pending: [], overdue: [], partially_paid: [], paid: [], cancelled: [] };
    for (const r of rows) byStatus[r.paymentStatus]?.push(r);

    for (const status of STATUS_ORDER) {
      const group = byStatus[status];
      if (group.length === 0) continue;
      const value = group.reduce((sum, r) => sum + r.paymentAmount, 0);
      doc.moveDown(0.5).fillColor('#000').fontSize(13).text(`${STATUS_LABELS[status]} (${group.length}) — ${value.toLocaleString()}`);
      doc.moveDown(0.2);
      for (const r of group) {
        doc.fontSize(10).fillColor('#000').text(`• ${r.vendorName} — ${r.paymentAmount.toLocaleString()} ${r.currency}`);
        const meta2 = [r.invoiceNumber, r.department, r.dueDate].filter(Boolean).join(' · ');
        if (meta2) doc.fontSize(8).fillColor('#666').text(`  ${meta2}`);
      }
    }

    if (rows.length === 0) {
      doc.fontSize(11).fillColor('#666').text('No finance documents match the current filters.');
    }
  }

  async toExcel(rows: FinanceExportRow[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Finance Documents');

    const totalByStatus = new Map<string, number>();
    for (const r of rows) totalByStatus.set(r.paymentStatus, (totalByStatus.get(r.paymentStatus) ?? 0) + r.paymentAmount);
    for (const status of STATUS_ORDER) {
      sheet.addRow([STATUS_LABELS[status], totalByStatus.get(status) ?? 0]);
    }
    sheet.addRow([]);

    const headers = ['Vendor', 'Invoice #', 'Invoice Date', 'Due Date', 'Amount', 'Currency', 'Status', 'Department', 'Cost Center', 'Category', 'Payment Method'];
    sheet.addRow(headers);
    for (const r of rows) {
      sheet.addRow([
        r.vendorName,
        r.invoiceNumber,
        r.invoiceDate,
        r.dueDate,
        r.paymentAmount,
        r.currency,
        STATUS_LABELS[r.paymentStatus] ?? r.paymentStatus,
        r.department,
        r.costCenter,
        r.expenseCategory,
        r.paymentMethod,
      ]);
    }
    for (let i = 1; i <= headers.length; i++) {
      sheet.getColumn(i).width = 18;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
