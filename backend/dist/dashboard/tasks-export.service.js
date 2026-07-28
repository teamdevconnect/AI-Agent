"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksExportService = void 0;
const common_1 = require("@nestjs/common");
const json2csv_1 = require("json2csv");
let TasksExportService = class TasksExportService {
    toCsv(tasks) {
        const parser = new json2csv_1.Parser({
            fields: ['title', 'priority', 'category', 'isOverdue', 'status', 'agentId', 'reportType', 'date'],
        });
        return parser.parse(tasks);
    }
    writePdf(doc, tasks, meta) {
        doc.fontSize(18).text('Task Export', { align: 'left' });
        const range = meta.dateFrom
            ? meta.dateTo && meta.dateTo !== meta.dateFrom
                ? `${meta.dateFrom} – ${meta.dateTo}`
                : meta.dateFrom
            : 'Today';
        doc.fontSize(10).fillColor('#666').text(range);
        doc.moveDown();
        const byStatus = { todo: [], in_progress: [], done: [] };
        for (const t of tasks)
            byStatus[t.status]?.push(t);
        const labels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
        for (const status of ['todo', 'in_progress', 'done']) {
            const group = byStatus[status];
            if (group.length === 0)
                continue;
            doc.moveDown(0.5).fillColor('#000').fontSize(13).text(`${labels[status]} (${group.length})`);
            doc.moveDown(0.2);
            for (const t of group) {
                const meta2 = [t.priority.toUpperCase(), t.isOverdue ? 'OVERDUE' : null, t.category].filter(Boolean).join(' · ');
                doc.fontSize(10).fillColor('#000').text(`• ${t.title}`, { continued: false });
                if (meta2)
                    doc.fontSize(8).fillColor('#666').text(`  ${meta2}`);
            }
        }
        if (tasks.length === 0) {
            doc.fontSize(11).fillColor('#666').text('No tasks in this range.');
        }
    }
};
exports.TasksExportService = TasksExportService;
exports.TasksExportService = TasksExportService = __decorate([
    (0, common_1.Injectable)()
], TasksExportService);
//# sourceMappingURL=tasks-export.service.js.map