import { IsIn } from 'class-validator';
import { ListDealsQueryDto } from './list-deals-query.dto';

export class ExportDealsQueryDto extends ListDealsQueryDto {
  @IsIn(['csv', 'xlsx', 'pdf'])
  format: 'csv' | 'xlsx' | 'pdf';
}
