import { IsIn } from 'class-validator';
import { GetRoyaltyReportQueryDto } from './get-royalty-report-query.dto';

export class ExportRoyaltyReportQueryDto extends GetRoyaltyReportQueryDto {
  @IsIn(['csv', 'xlsx', 'pdf'])
  format: 'csv' | 'xlsx' | 'pdf';
}
