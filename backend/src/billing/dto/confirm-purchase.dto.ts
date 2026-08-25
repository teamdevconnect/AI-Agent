import { IsOptional, IsString, MinLength } from 'class-validator';

// Body sent right after a real (non-simulated) checkout's client-side
// success handler fires — see billing.service.ts's confirmPurchase for why
// this is safe to trust despite coming from the browser. `signature` is
// Razorpay-specific (its checkout hands the browser an HMAC); Stripe/
// Cashfree confirm by re-fetching status from their own API instead, so
// it's optional here rather than required for every gateway.
export class ConfirmPurchaseDto {
  @IsString()
  @MinLength(1)
  paymentRecordId: string;

  @IsString()
  @MinLength(1)
  gatewayPaymentId: string;

  @IsOptional()
  @IsString()
  signature?: string;
}
