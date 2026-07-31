import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

export class GetAchievementQueryDto {
  @IsIn(['org', 'store', 'user'])
  scope: 'org' | 'store' | 'user';

  @IsOptional()
  @IsString()
  scopeId?: string;

  @Matches(PERIOD, { message: 'period must be in "YYYY-MM" format' })
  period: string;
}
