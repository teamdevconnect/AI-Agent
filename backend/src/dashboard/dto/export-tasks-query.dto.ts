import { IsIn } from 'class-validator';
import { ListTasksQueryDto } from './list-tasks-query.dto';

export class ExportTasksQueryDto extends ListTasksQueryDto {
  @IsIn(['pdf', 'csv'])
  format: 'pdf' | 'csv';
}
