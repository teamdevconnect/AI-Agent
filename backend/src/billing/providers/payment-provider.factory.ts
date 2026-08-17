import { ConfigService } from '@nestjs/config';
import { CashfreePaymentProvider } from './cashfree-payment.provider';
import { PaymentProviderAdapter } from './payment-provider.interface';
import { RazorpayPaymentProvider } from './razorpay-payment.provider';
import { StripePaymentProvider } from './stripe-payment.provider';

/** Selects which concrete adapter is bound to the PAYMENT_PROVIDER token,
 * per config.billing.activePaymentProvider. All three concrete providers
 * are still registered as ordinary Nest providers (see billing.module.ts)
 * and fully constructed regardless of which is active — each is
 * independently either "configured" (real keys present) or "simulated"
 * (see each provider's own constructor warning), so their webhook routes
 * stay reachable and functional even for a non-active provider (useful
 * mid-migration between gateways). */
export function paymentProviderFactory(
  config: ConfigService,
  razorpay: RazorpayPaymentProvider,
  stripe: StripePaymentProvider,
  cashfree: CashfreePaymentProvider,
): PaymentProviderAdapter {
  const active = config.get<string>('billing.activePaymentProvider') ?? 'razorpay';
  switch (active) {
    case 'stripe':
      return stripe;
    case 'cashfree':
      return cashfree;
    default:
      return razorpay;
  }
}
