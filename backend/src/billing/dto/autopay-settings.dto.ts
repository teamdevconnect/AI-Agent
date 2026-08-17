import { IsBoolean, IsOptional, IsNumber, IsString, Min } from 'class-validator';

export class AutoPaySettingsDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  thresholdCredits?: number;

  // The flat number of credits Auto Recharge adds each time it triggers —
  // validated as > 0 in AutoPayService.updateSettings, not here, since that
  // check needs to fall back to the wallet's already-saved value when the
  // request doesn't set this field.
  @IsOptional()
  @IsNumber()
  @Min(1)
  rechargeAmountCredits?: number;

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
