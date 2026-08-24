import { IsIn } from 'class-validator';
import { ListBiEmailsQueryDto } from './list-bi-emails-query.dto';

export class ExportBiEmailsQueryDto extends ListBiEmailsQueryDto {
  @IsIn(['csv', 'xlsx', 'pdf'])
  format: 'csv' | 'xlsx' | 'pdf';
}
