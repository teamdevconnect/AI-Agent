import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';
import { RoyaltySlidingTierDto } from './royalty-sliding-tier.dto';

// Only a not-yet-effective version can be reached by
// RoyaltyRulesService.updateFutureVersion — see its own comment for why.
export class UpdateRoyaltyRuleDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  royaltyPercentage?: number;

  @IsOptional()
  @IsIn(['none', 'min', 'max', 'sliding'])
  capType?: 'none' | 'min' | 'max' | 'sliding';

  @IsOptional()
  @IsNumber()
  @Min(0)
  capValue?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoyaltySlidingTierDto)
  slidingTiers?: RoyaltySlidingTierDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  adminFeePercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  techFeePercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  marketingFeePercentage?: number;

  @IsOptional()
  @IsBoolean()
  excludeTax?: boolean;

  @IsOptional()
  @IsBoolean()
  excludeShipping?: boolean;

  @IsOptional()
  @IsBoolean()
  excludeDiscount?: boolean;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;
}
