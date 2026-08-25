import { IsNumber, IsOptional, Min } from 'class-validator';

// Shared nested DTO for Create/UpdateRoyaltyRuleDto — mirrors
// RoyaltySlidingTier's schema shape. The interpretation of how a tier
// actually applies (marginal/bracket-stacked vs. single-bracket-for-the-
// whole-amount) is a Phase 20b calculation-engine decision, not fixed by
// this shape.
export class RoyaltySlidingTierDto {
  @IsNumber()
  @Min(0)
  fromValue: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  toValue?: number;

  @IsNumber()
  @Min(0)
  percentage: number;
}
