import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EncryptionService } from '../common/encryption/encryption.service';
import { PAYMENT_PROVIDER, PaymentProviderAdapter } from './providers/payment-provider.interface';
import { PricingService } from './pricing.service';
import { WalletService } from './wallet.service';
import { PaymentMethod, PaymentMethodDocument } from './schemas/payment-method.schema';
import { PaymentRecord, PaymentRecordDocument } from './schemas/payment-record.schema';
import { Wallet, WalletDocument } from './schemas/wallet.schema';

export interface AutoPaySettingsUpdate {
  enabled: boolean;
  thresholdCredits?: number;
  rechargeAmountCredits?: number;
  paymentMethodId?: string;
  monthlyCapCredits?: number;
}

/**
 * "Auto Recharge" (customer-facing name, matching OpenAI's API billing
 * terminology) — a Haive Credits setting only, with no notion of which LLM
 * provider a request ends up using. Triggered synchronously from
 * ReservationService.reserve() when balance is insufficient.
 *
 * Fixed threshold + fixed recharge amount: when balanceCredits drops to
 * thresholdCredits or below, this charges exactly rechargeAmountCredits —
 * a flat amount, independent of how far below the threshold the balance
 * actually is. Converted to a real charge amount via PricingService's
 * credits<->currency bridge, same as every other credit-to-money
 * conversion in this module.
 */
@Injectable()
export class AutoPayService {
  private readonly logger = new Logger(AutoPayService.name);

  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(PaymentMethod.name) private paymentMethodModel: Model<PaymentMethodDocument>,
    @InjectModel(PaymentRecord.name) private paymentRecordModel: Model<PaymentRecordDocument>,
    @Inject(PAYMENT_PROVIDER) private paymentProvider: PaymentProviderAdapter,
    private walletService: WalletService,
    private pricing: PricingService,
    private encryption: EncryptionService,
    private config: ConfigService,
  ) {}

  async updateSettings(organizationId: string, update: AutoPaySettingsUpdate): Promise<WalletDocument> {
    const wallet = await this.walletService.getOrCreateWallet(organizationId);

    if (update.enabled) {
      const rechargeAmount = update.rechargeAmountCredits ?? wallet.autoPay.rechargeAmountCredits;
      if (!(rechargeAmount > 0)) {
        throw new BadRequestException('The recharge amount must be greater than zero.');
      }
      const paymentMethodId = update.paymentMethodId ?? wallet.autoPay.paymentMethodId;
      if (!paymentMethodId) {
        throw new BadRequestException('A saved payment method is required to enable Auto Recharge.');
      }
      const method = await this.paymentMethodModel.findOne({ _id: paymentMethodId, organizationId });
      if (!method) throw new BadRequestException('That payment method is not on file for this organization.');
    }

    wallet.autoPay.enabled = update.enabled;
    if (update.thresholdCredits !== undefined) wallet.autoPay.thresholdCredits = update.thresholdCredits;
    if (update.rechargeAmountCredits !== undefined) wallet.autoPay.rechargeAmountCredits = update.rechargeAmountCredits;
    if (update.paymentMethodId !== undefined) wallet.autoPay.paymentMethodId = update.paymentMethodId;
    if (update.monthlyCapCredits !== undefined) wallet.autoPay.monthlyCapCredits = update.monthlyCapCredits;
    if (!update.enabled) {
      wallet.autoPay.consecutiveFailures = 0;
    }
    // Required — a wallet whose autoPay subdocument was created via the
    // upsert path in WalletService.getOrCreateWallet doesn't reliably carry
    // Mongoose's automatic dirty-tracking for in-place mutations of a
    // single-nested subdocument's own fields; without this, wallet.save()
    // silently persists nothing for this path (caught live: the response
    // reflected enabled:true but a fresh read showed enabled:false).
    wallet.markModified('autoPay');
    await wallet.save();
    return wallet;
  }

  /** Charges the org's saved payment method for exactly
   * rechargeAmountCredits (a flat amount), and credits the wallet on
   * success. Returns false (never throws) on any failure — the caller
   * (ReservationService) treats a false return as "Auto Recharge did not
   * help," not as a hard error. */
  async attemptRecharge(organizationId: string, reason: string): Promise<boolean> {
    const wallet = await this.walletService.getOrCreateWallet(organizationId);
    if (!wallet.autoPay?.enabled || !wallet.autoPay.paymentMethodId) {
      return false;
    }

    const maxFailures = this.config.get<number>('billing.autoPayMaxConsecutiveFailures') ?? 3;
    if (wallet.autoPay.consecutiveFailures >= maxFailures) {
      this.logger.warn(`Auto Recharge for org ${organizationId} skipped — ${wallet.autoPay.consecutiveFailures} consecutive failures already recorded.`);
      return false;
    }

    const creditsNeeded = wallet.autoPay.rechargeAmountCredits;
    if (!(creditsNeeded > 0)) {
      return false;
    }

    if (wallet.autoPay.monthlyCapCredits) {
      const alreadyRecharged = await this.walletService.sumAutoRechargeThisMonth(organizationId);
      if (alreadyRecharged + creditsNeeded > wallet.autoPay.monthlyCapCredits) {
        this.logger.warn(
          `Auto Recharge for org ${organizationId} skipped — monthly cap of ${wallet.autoPay.monthlyCapCredits} credits would be exceeded (already recharged ${alreadyRecharged} this month, would need ${creditsNeeded} more).`,
        );
        return false;
      }
    }

    const method = await this.paymentMethodModel.findOne({ _id: wallet.autoPay.paymentMethodId, organizationId });
    if (!method) {
      this.logger.warn(`Auto Recharge for org ${organizationId} misconfigured (payment method missing) — disabling.`);
      wallet.autoPay.enabled = false;
      wallet.markModified('autoPay');
      await wallet.save();
      return false;
    }

    // Auto Recharge must always charge through the payment method's OWN
    // saved gateway, not whichever provider happens to be active right now
    // — a deployment could switch ACTIVE_PAYMENT_PROVIDER after a customer
    // already saved a Razorpay card, and this method's saved token would
    // be meaningless to Stripe/Cashfree.
    if (method.provider !== this.paymentProvider.providerKey) {
      this.logger.warn(
        `Auto Recharge for org ${organizationId} skipped — saved payment method belongs to "${method.provider}" but the active gateway is "${this.paymentProvider.providerKey}".`,
      );
      return false;
    }

    const amountUsd = this.pricing.creditsToUsd(creditsNeeded);
    const amount = this.pricing.usdToCurrency(amountUsd);
    const currency = this.pricing.billingCurrency;

    const record = await this.paymentRecordModel.create({
      organizationId,
      walletId: wallet._id.toString(),
      type: 'autopay',
      provider: this.paymentProvider.providerKey,
      gatewayOrderId: `autorecharge_${wallet._id.toString()}_${Date.now()}`,
      amount,
      currency,
      creditsGranted: creditsNeeded,
      status: 'created',
    });

    const charge = await this.paymentProvider.chargeSavedMethod(
      organizationId,
      method.gatewayCustomerId,
      this.encryption.decrypt(method.gatewayTokenIdEncrypted),
      amount,
      currency,
    );

    if (!charge.success) {
      record.status = 'failed';
      await record.save();
      wallet.autoPay.consecutiveFailures += 1;
      wallet.autoPay.lastTriggeredAt = new Date();
      if (wallet.autoPay.consecutiveFailures >= maxFailures) {
        wallet.autoPay.enabled = false;
        this.logger.warn(`Auto Recharge for org ${organizationId} auto-disabled after ${maxFailures} consecutive failures.`);
      }
      wallet.markModified('autoPay');
      await wallet.save();
      return false;
    }

    record.status = 'captured';
    record.gatewayPaymentId = charge.paymentId;
    record.simulated = charge.simulated;
    await record.save();

    await this.walletService.applyLedgerEntry(organizationId, 'AUTO_RECHARGE', creditsNeeded, {
      paymentRecordId: record._id.toString(),
      metadata: {
        reason,
        rechargeAmountCredits: wallet.autoPay.rechargeAmountCredits,
        thresholdCredits: wallet.autoPay.thresholdCredits,
        provider: this.paymentProvider.providerKey,
        simulated: charge.simulated,
        gatewayPaymentId: charge.paymentId,
      },
      createdBy: 'autopay',
    });

    wallet.autoPay.consecutiveFailures = 0;
    wallet.autoPay.lastTriggeredAt = new Date();
    wallet.markModified('autoPay');
    await wallet.save();
    return true;
  }
}
