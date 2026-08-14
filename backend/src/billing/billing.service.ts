import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PAYMENT_PROVIDER, PaymentProviderAdapter } from './providers/payment-provider.interface';
import { WalletService, WalletSummary } from './wallet.service';
import { CreditPackage, CreditPackageDocument } from './schemas/credit-package.schema';
import { PaymentMethod, PaymentMethodDocument } from './schemas/payment-method.schema';
import { PaymentRecord, PaymentRecordDocument } from './schemas/payment-record.schema';
import { WalletTransaction, WalletTransactionDocument, WalletTransactionType } from './schemas/wallet-transaction.schema';

export interface CustomerTransaction {
  id: string;
  type: WalletTransactionType;
  amountCredits: number;
  balanceAfterCredits: number;
  createdAt: Date;
  description: string;
  // Only populated for AI_USAGE rows — non-identifying token totals (see
  // "Haive Input/Output/Total Tokens" in the spec) are customer-facing,
  // unlike everything else this domain tracks about a chat turn's cost.
  inputTokens?: number;
  outputTokens?: number;
}

export interface UsageSummary {
  availableCredits: number;
  creditsUsedTotal: number;
  totalPurchasedCredits: number;
  aiRequestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  usageTodayCredits: number;
  usageThisMonthCredits: number;
}

const TRANSACTION_DESCRIPTIONS: Record<WalletTransactionType, string> = {
  PURCHASE: 'Credit purchase',
  AI_USAGE: 'Haive AI usage',
  AUTO_RECHARGE: 'Auto Recharge',
  BONUS: 'Bonus credits',
  PROMOTION: 'Promotional credits',
  REFUND: 'Refund',
  MANUAL_ADJUSTMENT: 'Manual adjustment',
};

export interface InitiatePurchaseResult {
  paymentRecordId: string;
  orderId: string;
  checkoutParams: Record<string, unknown>;
  simulated: boolean;
  creditedImmediately: boolean;
  wallet?: WalletSummary;
}

/**
 * Customer-facing billing operations — wallet summary, credit packages,
 * purchases, and saved payment methods. Everything here returns only
 * Haive terminology (credits/usage/packages); never a provider name, model,
 * or provider cost — see billing.controller.ts's routes for the boundary.
 */
@Injectable()
export class BillingService {
  constructor(
    @InjectModel(CreditPackage.name) private packageModel: Model<CreditPackageDocument>,
    @InjectModel(PaymentMethod.name) private paymentMethodModel: Model<PaymentMethodDocument>,
    @InjectModel(PaymentRecord.name) private paymentRecordModel: Model<PaymentRecordDocument>,
    @InjectModel(WalletTransaction.name) private transactionModel: Model<WalletTransactionDocument>,
    @Inject(PAYMENT_PROVIDER) private paymentProvider: PaymentProviderAdapter,
    private wallet: WalletService,
    private config: ConfigService,
  ) {}

  async getWalletSummary(organizationId: string): Promise<WalletSummary> {
    const defaultThreshold = this.config.get<number>('billing.lowBalanceThresholdCredits') ?? 200;
    return this.wallet.getSummary(organizationId, defaultThreshold);
  }

  listPackages() {
    return this.packageModel.find({ active: true }).sort({ sortOrder: 1 }).exec();
  }

  /** Customer-safe transaction history — deliberately strips
   * WalletTransaction.metadata (which carries providerCostUsd/byProvider
   * for AI_USAGE rows, used only by billing-admin.service.ts) before this
   * ever leaves the server. This is the actual enforcement point for "the
   * customer only sees Haive Credits, never provider cost" — not a
   * frontend hide. */
  async listCustomerTransactions(organizationId: string, limit?: number): Promise<CustomerTransaction[]> {
    const rows = await this.wallet.listTransactions(organizationId, limit);
    return rows.map((row: WalletTransactionDocument) => ({
      id: row._id.toString(),
      type: row.type,
      amountCredits: row.amountCredits,
      balanceAfterCredits: row.balanceAfterCredits,
      createdAt: (row as unknown as { createdAt: Date }).createdAt,
      description: TRANSACTION_DESCRIPTIONS[row.type],
      inputTokens: row.type === 'AI_USAGE' ? (row.metadata.totalInputTokens as number | undefined) : undefined,
      outputTokens: row.type === 'AI_USAGE' ? (row.metadata.totalOutputTokens as number | undefined) : undefined,
    }));
  }

  /** Powers the customer Command Center's stat tiles — Haive Credits/
   * Requests/Tokens only, no provider identity anywhere in this
   * aggregation (it only ever reads amountCredits and the two
   * non-identifying token totals from AI_USAGE metadata). */
  async getUsageSummary(organizationId: string): Promise<UsageSummary> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);

    const [usageRows, purchaseRows, todayRows, monthRows, walletSummary] = await Promise.all([
      this.transactionModel
        .aggregate<{ credits: number; count: number; inputTokens: number; outputTokens: number }>([
          { $match: { organizationId, type: 'AI_USAGE' } },
          {
            $group: {
              _id: null,
              credits: { $sum: { $abs: '$amountCredits' } },
              count: { $sum: 1 },
              inputTokens: { $sum: { $ifNull: ['$metadata.totalInputTokens', 0] } },
              outputTokens: { $sum: { $ifNull: ['$metadata.totalOutputTokens', 0] } },
            },
          },
        ])
        .exec(),
      this.transactionModel
        .aggregate<{ credits: number }>([
          { $match: { organizationId, type: { $in: ['PURCHASE', 'AUTO_RECHARGE', 'BONUS', 'PROMOTION'] } } },
          { $group: { _id: null, credits: { $sum: '$amountCredits' } } },
        ])
        .exec(),
      this.transactionModel
        .aggregate<{ credits: number }>([
          { $match: { organizationId, type: 'AI_USAGE', createdAt: { $gte: startOfDay } } },
          { $group: { _id: null, credits: { $sum: { $abs: '$amountCredits' } } } },
        ])
        .exec(),
      this.transactionModel
        .aggregate<{ credits: number }>([
          { $match: { organizationId, type: 'AI_USAGE', createdAt: { $gte: startOfMonth } } },
          { $group: { _id: null, credits: { $sum: { $abs: '$amountCredits' } } } },
        ])
        .exec(),
      this.getWalletSummary(organizationId),
    ]);

    const usage = usageRows[0] ?? { credits: 0, count: 0, inputTokens: 0, outputTokens: 0 };
    return {
      availableCredits: walletSummary.availableCredits,
      creditsUsedTotal: usage.credits,
      totalPurchasedCredits: purchaseRows[0]?.credits ?? 0,
      aiRequestCount: usage.count,
      totalInputTokens: usage.inputTokens,
      totalOutputTokens: usage.outputTokens,
      totalTokens: usage.inputTokens + usage.outputTokens,
      usageTodayCredits: todayRows[0]?.credits ?? 0,
      usageThisMonthCredits: monthRows[0]?.credits ?? 0,
    };
  }

  listPaymentMethods(organizationId: string) {
    return this.paymentMethodModel.find({ organizationId }).sort({ createdAt: -1 }).exec();
  }

  /** Creates a checkout order for a credit package. Purchases must be
   * confirmed by a verified payment event before credits are permanently
   * granted — in "simulated" mode (no active-gateway keys configured) there
   * is no real webhook that will ever arrive, so the adapter's own
   * simulated success is treated as that confirmation and the wallet is
   * credited synchronously, in this same request. Once real keys are
   * configured, createCheckoutOrder returns simulated:false and crediting
   * happens exclusively from the verified webhook
   * (billing-webhook.controller.ts) — the client-side checkout callback is
   * never trusted on its own. */
  async initiatePurchase(organizationId: string, userId: string, packageKey: string): Promise<InitiatePurchaseResult> {
    const pkg = await this.packageModel.findOne({ key: packageKey, active: true });
    if (!pkg) throw new BadRequestException(`Unknown or inactive credit package "${packageKey}".`);

    const order = await this.paymentProvider.createCheckoutOrder(organizationId, pkg.price, pkg.currency, pkg.key);

    const record = await this.paymentRecordModel.create({
      organizationId,
      walletId: (await this.wallet.getOrCreateWallet(organizationId))._id.toString(),
      type: 'purchase',
      provider: this.paymentProvider.providerKey,
      creditPackageId: pkg.key,
      gatewayOrderId: order.orderId,
      amount: pkg.price,
      currency: pkg.currency,
      creditsGranted: pkg.credits + pkg.bonusCredits,
      status: order.simulated ? 'captured' : 'created',
      simulated: order.simulated,
    });

    if (!order.simulated) {
      return {
        paymentRecordId: record._id.toString(),
        orderId: order.orderId,
        checkoutParams: order.checkoutParams,
        simulated: false,
        creditedImmediately: false,
      };
    }

    await this.wallet.applyLedgerEntry(organizationId, 'PURCHASE', pkg.credits + pkg.bonusCredits, {
      paymentRecordId: record._id.toString(),
      metadata: { packageKey: pkg.key, provider: this.paymentProvider.providerKey, simulated: true, gatewayOrderId: order.orderId },
      createdBy: userId,
    });

    return {
      paymentRecordId: record._id.toString(),
      orderId: order.orderId,
      checkoutParams: order.checkoutParams,
      simulated: true,
      creditedImmediately: true,
      wallet: await this.getWalletSummary(organizationId),
    };
  }

  /** Confirms a real (non-simulated) purchase right after checkout — the
   * path used when the app isn't publicly reachable, so a gateway webhook
   * (billing-webhook.controller.ts) can never arrive to grant credits on
   * its own. Not a weaker substitute for the webhook: each adapter's
   * confirmPayment() only returns success from cryptographic/API proof it
   * controls (a signature only the gateway could have produced, or a
   * direct re-fetch of the payment's status from the gateway's own API) —
   * never from anything the client merely claims.
   *
   * Safe to race an eventual webhook for the same payment: the status flip
   * from non-captured to 'captured' is itself the atomic guard
   * (findOneAndUpdate with a `status: {$ne: 'captured'}` filter) — whichever
   * of this method or the webhook handler gets there first grants the
   * credits; the second sees the record already captured and no-ops. */
  async confirmPurchase(
    organizationId: string,
    userId: string,
    paymentRecordId: string,
    gatewayPaymentId: string,
    signature: string,
  ): Promise<{ confirmed: boolean; wallet: WalletSummary }> {
    const record = await this.paymentRecordModel.findOne({ _id: paymentRecordId, organizationId });
    if (!record) throw new NotFoundException('Payment record not found.');

    if (record.status === 'captured') {
      // Already confirmed — by a previous call to this method, or by a
      // webhook that beat us to it. Idempotent, not an error.
      return { confirmed: true, wallet: await this.getWalletSummary(organizationId) };
    }

    const result = await this.paymentProvider.confirmPayment(record.gatewayOrderId, gatewayPaymentId, signature);
    if (!result.success) {
      throw new BadRequestException(result.reason ?? 'Payment could not be verified.');
    }

    const updated = await this.paymentRecordModel.findOneAndUpdate(
      { _id: paymentRecordId, status: { $ne: 'captured' } },
      { status: 'captured', gatewayPaymentId, gatewaySignature: signature },
      { new: true },
    );
    if (!updated) {
      // Lost the race to a concurrent webhook delivery — it already
      // credited the wallet, so this call must not credit it again.
      return { confirmed: true, wallet: await this.getWalletSummary(organizationId) };
    }

    await this.wallet.applyLedgerEntry(organizationId, updated.type === 'autopay' ? 'AUTO_RECHARGE' : 'PURCHASE', updated.creditsGranted, {
      paymentRecordId: updated._id.toString(),
      metadata: { packageKey: updated.creditPackageId, provider: this.paymentProvider.providerKey, gatewayPaymentId, simulated: false },
      createdBy: userId,
    });

    return { confirmed: true, wallet: await this.getWalletSummary(organizationId) };
  }

  async savePaymentMethod(
    organizationId: string,
    gatewayCustomerId: string,
    gatewayPaymentId: string,
    signature: string,
    gatewayOrderId: string,
  ) {
    let saved;
    try {
      saved = await this.paymentProvider.saveMethodFromCheckout(
        organizationId,
        gatewayCustomerId,
        gatewayPaymentId,
        signature,
        gatewayOrderId,
      );
    } catch (err) {
      // The active gateway only ever throws here on a failed/forged
      // checkout proof (e.g. no real order/payment/signature behind the
      // call) — a client-side mistake, not a server fault. Surfacing it as
      // a plain 400 (instead of letting the raw Error bubble into Nest's
      // generic 500 handler) is what turns "add payment method" into an
      // actionable message instead of a crash.
      const message = err instanceof Error ? err.message : 'Could not verify the payment for this card.';
      throw new BadRequestException(
        `${message} A payment method can only be saved from a real, completed checkout — purchase Haive Credits and choose to save your card at checkout to make it available for Auto Recharge.`,
      );
    }
    const isFirst = (await this.paymentMethodModel.countDocuments({ organizationId })) === 0;
    return this.paymentMethodModel.create({
      organizationId,
      provider: this.paymentProvider.providerKey,
      gatewayCustomerId: saved.gatewayCustomerId,
      gatewayTokenIdEncrypted: saved.gatewayTokenIdEncrypted,
      cardLast4: saved.cardLast4,
      cardNetwork: saved.cardNetwork,
      isDefault: isFirst,
    });
  }

  async deletePaymentMethod(organizationId: string, paymentMethodId: string) {
    const result = await this.paymentMethodModel.deleteOne({ _id: paymentMethodId, organizationId });
    if (result.deletedCount === 0) throw new NotFoundException('Payment method not found.');
  }
}
