import { IsOptional, IsString, Matches } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class GetAnalyticsOverviewQueryDto {
  @Matches(DATE, { message: 'dateFrom must be in "YYYY-MM-DD" format' })
  dateFrom: string;

  @Matches(DATE, { message: 'dateTo must be in "YYYY-MM-DD" format' })
  dateTo: string;

  // Owner/admin only — narrows org-wide scope down to one store. Ignored
  // (never trusted) for manager/consultant callers, whose scope is always
  // server-derived from their own account.
  @IsOptional()
  @IsString()
  storeId?: string;
}
