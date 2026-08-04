import { Injectable } from '@nestjs/common';
import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import { TaskOut } from './tasks.service';

@Injectable()
export class TasksExportService {
  toCsv(tasks: TaskOut[]): string {
    const parser = new Parser({
      fields: ['title', 'priority', 'category', 'isOverdue', 'status', 'agentId', 'reportType', 'date'],
    });
    return parser.parse(tasks);
  }

  writePdf(doc: PDFKit.PDFDocument, tasks: TaskOut[], meta: { dateFrom?: string; dateTo?: string }): void {
    doc.fontSize(18).text('Task Export', { align: 'left' });
    const range = meta.dateFrom
      ? meta.dateTo && meta.dateTo !== meta.dateFrom
        ? `${meta.dateFrom} – ${meta.dateTo}`
        : meta.dateFrom
      : 'Today';
    doc.fontSize(10).fillColor('#666').text(range);
    doc.moveDown();

    const byStatus: Record<string, TaskOut[]> = { todo: [], in_progress: [], done: [] };
    for (const t of tasks) byStatus[t.status]?.push(t);

    const labels: Record<string, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
    for (const status of ['todo', 'in_progress', 'done']) {
      const group = byStatus[status];
      if (group.length === 0) continue;
      doc.moveDown(0.5).fillColor('#000').fontSize(13).text(`${labels[status]} (${group.length})`);
      doc.moveDown(0.2);
      for (const t of group) {
        const meta2 = [t.priority.toUpperCase(), t.isOverdue ? 'OVERDUE' : null, t.category].filter(Boolean).join(' · ');
        doc.fontSize(10).fillColor('#000').text(`• ${t.title}`, { continued: false });
        if (meta2) doc.fontSize(8).fillColor('#666').text(`  ${meta2}`);
      }
    }

    if (tasks.length === 0) {
      doc.fontSize(11).fillColor('#666').text('No tasks in this range.');
    }
  }
}
