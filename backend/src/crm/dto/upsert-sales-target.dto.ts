import { IsIn, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

export class UpsertSalesTargetDto {
  @IsIn(['org', 'store', 'user'])
  scope: 'org' | 'store' | 'user';

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @Matches(PERIOD, { message: 'period must be in "YYYY-MM" format' })
  period: string;

  @IsNumber()
  @Min(0)
  targetAmount: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
