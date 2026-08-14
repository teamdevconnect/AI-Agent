import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreditPackage, CreditPackageDocument } from './schemas/credit-package.schema';
import { ProviderPricing, ProviderPricingDocument } from './schemas/provider-pricing.schema';

// Default credit packages ($5/$10/$20/$50/$100, per the user's spec) and the
// day-0 ProviderPricing rows, seeded from python-agent's existing
// observability/cost.py constants. Runs as an idempotent upsert on every
// boot (findOneAndUpdate + upsert:true, never a plain insert) rather than a
// one-off script — this codebase has no existing scripts/ convention to
// slot a migration into, and "just works on startup, safe to run every
// time" needs no separate manual step.
const DEFAULT_PACKAGES_USD: { key: string; name: string; usd: number; credits: number; bonusCredits: number; sortOrder: number }[] = [
  { key: 'starter', name: 'Starter', usd: 5, credits: 500, bonusCredits: 0, sortOrder: 1 },
  { key: 'basic', name: 'Basic', usd: 10, credits: 1000, bonusCredits: 0, sortOrder: 2 },
  { key: 'standard', name: 'Standard', usd: 20, credits: 2000, bonusCredits: 0, sortOrder: 3 },
  { key: 'pro', name: 'Pro', usd: 50, credits: 5000, bonusCredits: 250, sortOrder: 4 },
  { key: 'business', name: 'Business', usd: 100, credits: 10000, bonusCredits: 750, sortOrder: 5 },
];

// Mirrors python-agent/app/observability/cost.py's _RATES_PER_MTOK exactly
// — that file's own estimate stays in place unchanged as the settlement
// fallback for any (provider, model) with no active row here.
const DEFAULT_PROVIDER_PRICING = [
  { provider: 'anthropic', model: '*', inputCostPerMTokUsd: 3.0, outputCostPerMTokUsd: 15.0 },
  { provider: 'groq', model: '*', inputCostPerMTokUsd: 0.59, outputCostPerMTokUsd: 0.79 },
];

@Injectable()
export class BillingSeedService implements OnModuleInit {
  private readonly logger = new Logger(BillingSeedService.name);

  constructor(
    @InjectModel(CreditPackage.name) private packageModel: Model<CreditPackageDocument>,
    @InjectModel(ProviderPricing.name) private pricingModel: Model<ProviderPricingDocument>,
    private config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const rate = this.config.get<number>('billing.usdToCurrencyRate') ?? 83;
    const currency = this.config.get<string>('billing.currency') ?? 'INR';

    for (const pkg of DEFAULT_PACKAGES_USD) {
      await this.packageModel.findOneAndUpdate(
        { key: pkg.key },
        {
          $setOnInsert: {
            key: pkg.key,
            name: pkg.name,
            credits: pkg.credits,
            bonusCredits: pkg.bonusCredits,
            price: Math.round(pkg.usd * rate * 100) / 100,
            currency,
            active: true,
            sortOrder: pkg.sortOrder,
          },
        },
        { upsert: true },
      );
    }

    for (const rateRow of DEFAULT_PROVIDER_PRICING) {
      const existing = await this.pricingModel.findOne({ provider: rateRow.provider, model: rateRow.model, effectiveTo: null });
      if (!existing) {
        await this.pricingModel.create({ ...rateRow, effectiveFrom: new Date(), effectiveTo: null });
      }
    }

    this.logger.log('Billing defaults verified (credit packages + provider pricing).');
  }
}
