import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ListTasksQueryDto {
  @IsOptional()
  @IsIn(['todo', 'in_progress', 'done'])
  status?: 'todo' | 'in_progress' | 'done';

  @IsOptional()
  @IsString()
  @Matches(DATE, { message: 'dateFrom must be YYYY-MM-DD' })
  dateFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE, { message: 'dateTo must be YYYY-MM-DD' })
  dateTo?: string;
}
