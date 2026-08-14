import { IsBoolean, IsOptional, IsNumber, IsString, Min } from 'class-validator';

export class AutoPaySettingsDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  thresholdCredits?: number;

  // The balance Auto Recharge tops up to when triggered — validated
  // against thresholdCredits (must be higher) in AutoPayService.updateSettings,
  // not here, since that check needs whichever of the two the request
  // didn't set to fall back to the wallet's already-saved value.
  @IsOptional()
  @IsNumber()
  @Min(1)
  targetBalanceCredits?: number;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  // Hard ceiling on how many credits Auto Recharge may grant in a calendar
  // month — checked in AutoPayService.attemptRecharge before every charge.
  // Unset (undefined/0) means no cap.
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyCapCredits?: number;
}
