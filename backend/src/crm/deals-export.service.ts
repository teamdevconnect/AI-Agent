import { Injectable } from '@nestjs/common';
import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { DealDocument } from './schemas/deal.schema';

export interface DealExportRow {
  name: string;
  dealStatus: string;
  monetaryValue: number;
  expectedClosingDate?: string;
  ownerName: string;
  storeName: string;
  stageId?: string;
  leadSource?: string;
  product?: string;
  customerType?: string;
  region?: string;
}

const STATUS_ORDER = ['won', 'lost', 'open'] as const;
const STATUS_LABELS: Record<string, string> = { won: 'Won', lost: 'Lost', open: 'Open' };

// Mirrors tasks-export.service.ts's structure exactly (json2csv for CSV,
// pdfkit for PDF, manual layout, no embedded charts) plus a new exceljs path
// for real Excel support — no Excel library existed anywhere in this repo
// before Phase 9a.
@Injectable()
export class DealsExportService {
  buildRows(deals: DealDocument[], ownerNameById: Map<string, string>, storeNameById: Map<string, string>): DealExportRow[] {
    return deals.map((d) => ({
      name: d.name,
      dealStatus: d.dealStatus,
      monetaryValue: d.monetaryValue,
      expectedClosingDate: d.expectedClosingDate,
      ownerName: d.ownerId ? (ownerNameById.get(d.ownerId) ?? 'Unknown user') : 'Unassigned',
      storeName: d.storeId ? (storeNameById.get(d.storeId) ?? 'Unknown store') : '—',
      stageId: d.stageId,
      leadSource: d.leadSource,
      product: d.product,
      customerType: d.customerType,
      region: d.region,
    }));
  }

  toCsv(rows: DealExportRow[]): string {
    const parser = new Parser({
      fields: [
        'name',
        'dealStatus',
        'monetaryValue',
        'expectedClosingDate',
        'ownerName',
        'storeName',
        'stageId',
        'leadSource',
        'product',
        'customerType',
        'region',
      ],
    });
    return parser.parse(rows);
  }

  writePdf(doc: PDFKit.PDFDocument, rows: DealExportRow[], meta: { dateFrom?: string; dateTo?: string }): void {
    doc.fontSize(18).text('Deal Export', { align: 'left' });
    const range = meta.dateFrom
      ? meta.dateTo && meta.dateTo !== meta.dateFrom
        ? `${meta.dateFrom} – ${meta.dateTo}`
        : meta.dateFrom
      : 'All time';
    doc.fontSize(10).fillColor('#666').text(range);
    doc.moveDown();

    const byStatus: Record<string, DealExportRow[]> = { won: [], lost: [], open: [] };
    for (const r of rows) byStatus[r.dealStatus]?.push(r);

    for (const status of STATUS_ORDER) {
      const group = byStatus[status];
      if (group.length === 0) continue;
      const value = group.reduce((sum, r) => sum + r.monetaryValue, 0);
      doc.moveDown(0.5).fillColor('#000').fontSize(13).text(`${STATUS_LABELS[status]} (${group.length}) — ${value.toLocaleString()}`);
      doc.moveDown(0.2);
      for (const r of group) {
        doc.fontSize(10).fillColor('#000').text(`• ${r.name} — ${r.monetaryValue.toLocaleString()}`);
        const meta2 = [r.ownerName, r.storeName, r.expectedClosingDate].filter(Boolean).join(' · ');
        if (meta2) doc.fontSize(8).fillColor('#666').text(`  ${meta2}`);
      }
    }

    if (rows.length === 0) {
      doc.fontSize(11).fillColor('#666').text('No deals match the current filters.');
    }
  }

  async toExcel(rows: DealExportRow[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Deals');

    const wonValue = rows.filter((r) => r.dealStatus === 'won').reduce((sum, r) => sum + r.monetaryValue, 0);
    const lostValue = rows.filter((r) => r.dealStatus === 'lost').reduce((sum, r) => sum + r.monetaryValue, 0);
    sheet.addRow(['Won value', wonValue]);
    sheet.addRow(['Lost value', lostValue]);
    sheet.addRow([]);

    const headers = [
      'Name',
      'Status',
      'Value',
      'Expected/Closing Date',
      'Owner',
      'Store',
      'Stage',
      'Lead Source',
      'Product',
      'Customer Type',
      'Region',
    ];
    sheet.addRow(headers);
    for (const r of rows) {
      sheet.addRow([
        r.name,
        r.dealStatus,
        r.monetaryValue,
        r.expectedClosingDate ?? '',
        r.ownerName,
        r.storeName,
        r.stageId ?? '',
        r.leadSource ?? '',
        r.product ?? '',
        r.customerType ?? '',
        r.region ?? '',
      ]);
    }
    for (let i = 1; i <= headers.length; i++) {
      sheet.getColumn(i).width = 18;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
