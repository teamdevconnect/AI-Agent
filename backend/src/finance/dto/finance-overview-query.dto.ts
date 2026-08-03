import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { FinanceFilterQueryDto } from './finance-filter-query.dto';

export class FinanceOverviewQueryDto extends FinanceFilterQueryDto {
  // Trend length for monthlyExpenseTrend, in months.
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;

  // Window for the "Upcoming Due Payments" bucket.
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(180)
  upcomingDueDays?: number;
}
