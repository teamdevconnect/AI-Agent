import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Decimal from 'decimal.js';

/**
 * The single place `customer_price = provider_cost / (1 - target_margin)`
 * exists in this codebase. Every service that turns a USD provider cost
 * into a Haive Credit charge (ReservationService's settle(), the admin
 * revenue/margin aggregation) calls through here — none of them re-derive
 * the formula themselves.
 *
 * 50% margin is NOT 50% markup: $10 cost / (1 - 0.5) = $20 price, $10
 * profit, 50% margin (profit/price). A naive "+50%" markup ($15 price)
 * would only be a 33% margin.
 *
 * Rounding policy: every intermediate step (provider_cost USD → customer
 * USD) stays high-precision via decimal.js; rounding to a whole Haive
 * Credit (HALF_UP) happens exactly once, in usdToCredits — the only place
 * in the entire billing domain a fraction of a credit is ever discarded.
 */
@Injectable()
export class PricingService {
  constructor(private config: ConfigService) {}

  private get creditValueUsd(): Decimal {
    return new Decimal(this.config.get<number>('billing.creditValueUsd') ?? 0.01);
  }

  private get targetGrossMargin(): Decimal {
    return new Decimal(this.config.get<number>('billing.targetGrossMargin') ?? 0.5);
  }

  /** provider_cost USD -> customer-facing USD, at the given (or default) margin. */
  costToCustomerUsd(costUsd: number, marginOverride?: number): Decimal {
    const margin = marginOverride !== undefined ? new Decimal(marginOverride) : this.targetGrossMargin;
    const retained = new Decimal(1).minus(margin);
    if (retained.lte(0)) {
      throw new Error(`Invalid gross margin ${margin.toString()} — must be less than 1.`);
    }
    return new Decimal(costUsd).dividedBy(retained);
  }

  /** provider_cost USD -> whole Haive Credits to charge (the only rounding boundary). */
  providerCostToCustomerCredits(costUsd: number, marginOverride?: number): number {
    const customerUsd = this.costToCustomerUsd(costUsd, marginOverride);
    return this.usdToCredits(customerUsd);
  }

  usdToCredits(usdAmount: number | Decimal): number {
    const usd = usdAmount instanceof Decimal ? usdAmount : new Decimal(usdAmount);
    return usd.dividedBy(this.creditValueUsd).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  }

  /** Credits -> USD, exact (no rounding) — for display/reporting only, never for charging. */
  creditsToUsd(credits: number): number {
    return new Decimal(credits).times(this.creditValueUsd).toNumber();
  }

  /** config.billing.currency — whatever credit packages are actually priced
   * in (not necessarily USD; see billing-seed.service.ts). */
  get billingCurrency(): string {
    return this.config.get<string>('billing.currency') ?? 'INR';
  }

  currencyToUsd(amount: number): number {
    const rate = this.config.get<number>('billing.usdToCurrencyRate') ?? 83;
    return new Decimal(amount).dividedBy(rate).toNumber();
  }

  usdToCurrency(amountUsd: number): number {
    const rate = this.config.get<number>('billing.usdToCurrencyRate') ?? 83;
    return new Decimal(amountUsd).times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }
}
