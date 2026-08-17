import { IsOptional, IsString, MinLength } from 'class-validator';

// Body for the "save card" step after a checkout order completes, against
// whichever gateway is currently active (config.billing.activePaymentProvider).
// In simulated mode (that gateway's keys not configured), only
// gatewayCustomerId is meaningful — the payment/signature fields are
// placeholders the provider fills in itself.
export class SavePaymentMethodDto {
  @IsString()
  @MinLength(1)
  gatewayCustomerId: string;

  @IsOptional()
  @IsString()
  gatewayPaymentId?: string;

  @IsOptional()
  @IsString()
  signature?: string;

  @IsOptional()
  @IsString()
  gatewayOrderId?: string;
}
