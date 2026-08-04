import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DealFilterQueryDto } from './deal-filter-query.dto';

export class DealPerformanceOverviewQueryDto extends DealFilterQueryDto {
  // Trend length for wonLostTrend/revenueProgress, in months.
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;
}
