import { IsOptional, IsString, Matches } from 'class-validator';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

// Was a raw `@Query('period') string` with no validation at all, flowing
// straight into `expectedClosingDate: { $regex: '^'+period }`
// (sales-analytics.service.ts's getAchievement) on a dashboard route every
// role hits — same "YYYY-MM" format GetAchievementQueryDto already enforces
// elsewhere, applied here too so a crafted query string can't reach the
// regex unvalidated.
export class BusinessDashboardQueryDto {
  @IsOptional()
  @Matches(PERIOD, { message: 'period must be in "YYYY-MM" format' })
  period?: string;

  @IsOptional()
  @IsString()
  storeId?: string;
}
