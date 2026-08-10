import { IsOptional, IsString, Matches } from 'class-validator';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

export class GetAnalyticsOverviewQueryDto {
  @IsOptional()
  @Matches(PERIOD, { message: 'period must be in "YYYY-MM" format' })
  period?: string;

  // Owner/admin only — narrows org-wide scope down to one store. Ignored
  // (never trusted) for manager/consultant callers, whose scope is always
  // server-derived from their own account.
  @IsOptional()
  @IsString()
  storeId?: string;
}
