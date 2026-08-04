import { TaskOut } from './tasks.service';
export declare class TasksExportService {
    toCsv(tasks: TaskOut[]): string;
    writePdf(doc: PDFKit.PDFDocument, tasks: TaskOut[], meta: {
        dateFrom?: string;
        dateTo?: string;
    }): void;
}
