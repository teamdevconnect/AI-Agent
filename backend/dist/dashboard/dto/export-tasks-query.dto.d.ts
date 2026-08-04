import { ListTasksQueryDto } from './list-tasks-query.dto';
export declare class ExportTasksQueryDto extends ListTasksQueryDto {
    format: 'pdf' | 'csv';
}
