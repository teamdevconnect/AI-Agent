import { IsIn } from 'class-validator';
import { FinanceListQueryDto } from './finance-list-query.dto';

export class FinanceExportQueryDto extends FinanceListQueryDto {
  @IsIn(['csv', 'xlsx', 'pdf'])
  format: 'csv' | 'xlsx' | 'pdf';
}
