import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PAYMENT_PROVIDER, PaymentProviderAdapter } from './providers/payment-provider.interface';
import { WalletService } from './wallet.service';
import { addBillingCycle, RecurringBillingCycle } from './billing-cycle.util';
import { BillingInvoiceService } from './billing-invoice.service';
import { CouponsService } from './coupons.service';
import { ConfirmSubscriptionDto } from './dto/confirm-subscription.dto';
import { SubscriptionCheckoutDto } from './dto/subscription-checkout.dto';
import { BillingPlan, BillingPlanDocument } from './schemas/billing-plan.schema';
import { BillingCycle, BillingPlanPrice, BillingPlanPriceDocument } from './schemas/billing-plan-price.schema';
import { BillingSubscriptionEvent, BillingSubscriptionEventDocument } from './schemas/billing-subscription-event.schema';
import { BillingSubscription, BillingSubscriptionDocument, BillingSubscriptionStatus } from './schemas/billing-subscription.schema';
import { PaymentRecord, PaymentRecordDocument } from './schemas/payment-record.schema';

export interface PublicPlanPrice {
  id: string;
  currencyCode: string;
  billingCycle: BillingCycle;
  amount: number;
  creditsGranted: number;
}

export interface PublicPlanListing {
  id: string;
  key: string;
  name: string;
  description?: string;
  shortDescription?: string;
  icon?: string;
  image?: string;
  badgeText?: string;
  badgeColor?: string;
  planColor?: string;
  recommended: boolean;
  trialDays?: number;
  features: BillingPlan['features'];
  limits: BillingPlan['limits'];
  prices: PublicPlanPrice[];
}

export interface SubscriptionSummary {
  id: string;
  status: BillingSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  plan: { id: string; key: string; name: string } | null;
  price: { id: string; currencyCode: string; billingCycle: BillingCycle; amount: number; creditsGranted: number } | null;
}

export interface InitiateSubscriptionCheckoutResult {
  paymentRecordId: string;
  orderId: string;
  checkoutParams: Record<string, unknown>;
  simulated: boolean;
  activatedImmediately: boolean;
  subscription?: SubscriptionSummary;
}

/**
 * Customer-facing subscription operations — the Phase 2 layer that sits on
 * top of the existing credits wallet: subscribing to a plan grants a
 * recurring credit allotment (WalletService.applyLedgerEntry('SUBSCRIPTION_GRANT', ...))
 * rather than creating an independent money system. Reuses the exact
 * checkout/confirm/webhook-race patterns BillingService already established
 * for credit-package purchases — see initiatePurchase/confirmPurchase there
 * for the precedent this mirrors.
 */
@Injectable()
export class BillingSubscriptionsService {
  constructor(
    @InjectModel(BillingPlan.name) private planModel: Model<BillingPlanDocument>,
    @InjectModel(BillingPlanPrice.name) private priceModel: Model<BillingPlanPriceDocument>,
    @InjectModel(BillingSubscription.name) private subscriptionModel: Model<BillingSubscriptionDocument>,
    @InjectModel(BillingSubscriptionEvent.name) private eventModel: Model<BillingSubscriptionEventDocument>,
    @InjectModel(PaymentRecord.name) private paymentRecordModel: Model<PaymentRecordDocument>,
    @Inject(PAYMENT_PROVIDER) private paymentProvider: PaymentProviderAdapter,
    private wallet: WalletService,
    private coupons: CouponsService,
    private invoices: BillingInvoiceService,
    private config: ConfigService,
  ) {}

  /** Public catalog — active + isPublic plans only, with their currently
   * active price(s) in the requested (or platform-default) currency. Never
   * returns BillingPlan.internalDescription — same admin-only-context-never-
   * leaves-the-server discipline as BillingService.listCustomerTransactions
   * stripping WalletTransaction.metadata. */
  async listPublicPlans(currencyCode?: string): Promise<PublicPlanListing[]> {
    const currency = (currencyCode || this.config.get<string>('billing.currency') || 'INR').toUpperCase();
    const plans = await this.planModel.find({ active: true, isPublic: true }).sort({ sortOrder: 1 }).exec();
    if (plans.length === 0) return [];

    const planIds = plans.map((p) => p._id.toString());
    const prices = await this.priceModel
      .find({ planId: { $in: planIds }, currencyCode: currency, active: true, effectiveTo: null })
      .sort({ billingCycle: 1 })
      .exec();

    const pricesByPlan = new Map<string, BillingPlanPriceDocument[]>();
    for (const price of prices) {
      const list = pricesByPlan.get(price.planId) ?? [];
      list.push(price);
      pricesByPlan.set(price.planId, list);
    }

    return plans.map((plan) => ({
      id: plan._id.toString(),
      key: plan.key,
      name: plan.name,
      description: plan.description,
      shortDescription: plan.shortDescription,
      icon: plan.icon,
      image: plan.image,
      badgeText: plan.badgeText,
      badgeColor: plan.badgeColor,
      planColor: plan.planColor,
      recommended: plan.recommended,
      trialDays: plan.trialDays,
      features: plan.features,
      limits: plan.limits,
      prices: (pricesByPlan.get(plan._id.toString()) ?? []).map((price) => ({
        id: price._id.toString(),
        currencyCode: price.currencyCode,
        billingCycle: price.billingCycle,
        amount: price.amount,
        creditsGranted: price.creditsGranted,
      })),
    }));
  }

  async getCurrentSubscription(organizationId: string): Promise<SubscriptionSummary | null> {
    const subscription = await this.subscriptionModel
      .findOne({ organizationId, status: { $in: ['trialing', 'active', 'past_due'] } })
      .exec();
    if (!subscription) return null;
    return this.toSummary(subscription);
  }

  /** Creates a checkout order for a recurring plan price. Like
   * BillingService.initiatePurchase, a real (non-simulated) checkout is not
   * activated here — only once confirm()/the webhook observes a verified
   * payment.captured does activateFromCheckoutPayment ever run. In
   * simulated mode (no active-gateway keys) that confirmation can never
   * arrive from a real webhook, so it's applied synchronously in this same
   * request instead, exactly like initiatePurchase's simulated branch. */
  async checkout(organizationId: string, userId: string, dto: SubscriptionCheckoutDto): Promise<InitiateSubscriptionCheckoutResult> {
    const plan = await this.planModel.findOne({ _id: dto.planId, active: true }).exec();
    if (!plan) throw new BadRequestException('Unknown or inactive plan.');

    const price = await this.priceModel.findOne({ _id: dto.priceId, planId: dto.planId, active: true, effectiveTo: null }).exec();
    if (!price) throw new BadRequestException('Unknown or inactive price for this plan.');

    if (price.billingCycle === 'one_time') {
      throw new BadRequestException('This price is a one-time price, not a recurring subscription — use a credit package purchase instead.');
    }

    const existing = await this.subscriptionModel
      .findOne({ organizationId, status: { $in: ['trialing', 'active', 'past_due'] } })
      .exec();
    if (existing) {
      throw new BadRequestException(
        'This organization already has an active subscription. Cancel it before subscribing to a different plan.',
      );
    }

    let amount = price.amount;
    let creditsGranted = price.creditsGranted;
    let couponId: string | undefined;
    let couponDiscountAmount = 0;
    let couponBonusCredits = 0;

    if (dto.couponCode) {
      const applied = await this.coupons.validate(dto.couponCode, {
        organizationId,
        context: 'subscription_checkout',
        planId: dto.planId,
        amount,
        currencyCode: price.currencyCode,
      });
      couponId = applied.coupon._id.toString();
      couponDiscountAmount = applied.discountAmount;
      couponBonusCredits = applied.bonusCredits;
      amount = amount - couponDiscountAmount;
      creditsGranted = creditsGranted + couponBonusCredits;
    }

    const order = await this.paymentProvider.createCheckoutOrder(
      organizationId,
      amount,
      price.currencyCode,
      `plan_${plan.key}_${price.billingCycle}`,
    );

    const wallet = await this.wallet.getOrCreateWallet(organizationId);
    const record = await this.paymentRecordModel.create({
      organizationId,
      walletId: wallet._id.toString(),
      type: 'subscription_checkout',
      provider: this.paymentProvider.providerKey,
      subscriptionPlanId: dto.planId,
      subscriptionPriceId: dto.priceId,
      couponId,
      couponDiscountAmount: couponId ? couponDiscountAmount : undefined,
      couponBonusCredits: couponId ? couponBonusCredits : undefined,
      gatewayOrderId: order.orderId,
      amount,
      currency: price.currencyCode,
      creditsGranted,
      status: order.simulated ? 'captured' : 'created',
      simulated: order.simulated,
    });

    if (!order.simulated) {
      return {
        paymentRecordId: record._id.toString(),
        orderId: order.orderId,
        checkoutParams: order.checkoutParams,
        simulated: false,
        activatedImmediately: false,
      };
    }

    const subscription = await this.activateFromCheckoutPayment(record, userId);
    return {
      paymentRecordId: record._id.toString(),
      orderId: order.orderId,
      checkoutParams: order.checkoutParams,
      simulated: true,
      activatedImmediately: true,
      subscription: await this.toSummary(subscription),
    };
  }

  /** Mirrors BillingService.confirmPurchase's exact race-safety shape — see
   * that method's comment for why this is safe to race an eventual webhook
   * delivery for the same payment without ever activating twice. */
  async confirm(
    organizationId: string,
    userId: string,
    dto: ConfirmSubscriptionDto,
  ): Promise<{ confirmed: boolean; subscription: SubscriptionSummary | null }> {
    const record = await this.paymentRecordModel
      .findOne({ _id: dto.paymentRecordId, organizationId, type: 'subscription_checkout' })
      .exec();
    if (!record) throw new NotFoundException('Subscription checkout not found.');

    if (record.status === 'captured') {
      const subscription = record.subscriptionId ? await this.subscriptionModel.findById(record.subscriptionId).exec() : null;
      return { confirmed: true, subscription: subscription ? await this.toSummary(subscription) : null };
    }

    const result = await this.paymentProvider.confirmPayment(record.gatewayOrderId, dto.gatewayPaymentId, dto.signature ?? '');
    if (!result.success) {
      throw new BadRequestException(result.reason ?? 'Payment could not be verified.');
    }

    const updated = await this.paymentRecordModel.findOneAndUpdate(
      { _id: dto.paymentRecordId, status: { $ne: 'captured' } },
      { status: 'captured', gatewayPaymentId: dto.gatewayPaymentId, gatewaySignature: dto.signature ?? '' },
      { new: true },
    );
    if (!updated) {
      // Lost the race to a concurrent webhook delivery — it already activated.
      const existing = await this.subscriptionModel
        .findOne({ organizationId, status: { $in: ['trialing', 'active', 'past_due'] } })
        .exec();
      return { confirmed: true, subscription: existing ? await this.toSummary(existing) : null };
    }

    const subscription = await this.activateFromCheckoutPayment(updated, userId);
    return { confirmed: true, subscription: await this.toSummary(subscription) };
  }

  /** The single place a subscription_checkout/subscription_renewal
   * PaymentRecord turns into real entitlement — called from confirm() above,
   * from billing-webhook.controller.ts's payment.captured handler, and from
   * subscription-renewal.service.ts. Idempotent: if the record already
   * carries a subscriptionId, returns the existing subscription rather than
   * creating a second one. */
  async activateFromCheckoutPayment(record: PaymentRecordDocument, actorUserId: string): Promise<BillingSubscriptionDocument> {
    if (record.subscriptionId) {
      const existing = await this.subscriptionModel.findById(record.subscriptionId).exec();
      if (existing) return existing;
    }

    const planId = record.subscriptionPlanId;
    const priceId = record.subscriptionPriceId;
    if (!planId || !priceId) {
      throw new Error(`PaymentRecord ${record._id.toString()} has no subscription plan/price intent recorded.`);
    }
    const price = await this.priceModel.findById(priceId).exec();
    if (!price) {
      throw new Error(`BillingPlanPrice ${priceId} referenced by PaymentRecord ${record._id.toString()} no longer exists.`);
    }

    const now = new Date();
    const periodEnd = addBillingCycle(now, price.billingCycle as RecurringBillingCycle);

    let subscription: BillingSubscriptionDocument;
    try {
      subscription = await this.subscriptionModel.create({
        organizationId: record.organizationId,
        planId,
        planPriceId: priceId,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        lastRenewalPaymentRecordId: record._id.toString(),
        renewalFailureCount: 0,
        createdBy: actorUserId,
        couponId: record.couponId,
      });
    } catch (err) {
      const mongoErr = err as { code?: number };
      if (mongoErr.code === 11000) {
        // Lost a race to another concurrent activation for the same org —
        // the unique partial index (see billing-subscription.schema.ts) is
        // the final guard. Return the org's now-live subscription instead
        // of erroring; this payment simply didn't win the race.
        const existing = await this.subscriptionModel
          .findOne({ organizationId: record.organizationId, status: { $in: ['trialing', 'active', 'past_due'] } })
          .exec();
        if (existing) return existing;
      }
      throw err;
    }

    // record.creditsGranted (not price.creditsGranted) — already includes
    // any coupon free_credits bonus locked in at checkout time (see
    // checkout() above), so this is the correct total to grant regardless
    // of whether a coupon was applied.
    await this.wallet.applyLedgerEntry(record.organizationId, 'SUBSCRIPTION_GRANT', record.creditsGranted, {
      paymentRecordId: record._id.toString(),
      metadata: { planId, priceId, billingCycle: price.billingCycle, subscriptionId: subscription._id.toString() },
      createdBy: actorUserId,
    });

    record.subscriptionId = subscription._id.toString();
    await record.save();
    await this.coupons.recordRedemption(record, actorUserId, 'subscription_checkout');
    await this.invoices.generateForPaymentRecord(record);

    await this.eventModel.create({
      subscriptionId: subscription._id.toString(),
      organizationId: record.organizationId,
      type: 'created',
      metadata: { planId, priceId, paymentRecordId: record._id.toString() },
    });

    return subscription;
  }

  /** Soft cancel — the subscription keeps its entitlement through
   * currentPeriodEnd; subscription-renewal.service.ts is what actually
   * flips status to 'canceled' once that date passes, rather than clawing
   * back already-granted credits or access immediately. */
  async cancel(organizationId: string): Promise<SubscriptionSummary> {
    const subscription = await this.subscriptionModel
      .findOne({ organizationId, status: { $in: ['trialing', 'active', 'past_due'] } })
      .exec();
    if (!subscription) throw new NotFoundException('No active subscription found for this organization.');

    subscription.cancelAtPeriodEnd = true;
    await subscription.save();

    await this.eventModel.create({
      subscriptionId: subscription._id.toString(),
      organizationId,
      type: 'canceled',
      metadata: { effectiveAt: subscription.currentPeriodEnd },
    });

    return this.toSummary(subscription);
  }

  /** Admin-only cross-org list (Admin-haive's Subscriptions page) — the
   * customer-facing getCurrentSubscription above is intentionally
   * self-scoped and stays that way; this is a separate method, not a widened
   * version of it, gated by billing-admin-subscriptions.controller.ts's
   * @Roles('platform_admin'). */
  async adminList(filters: { organizationId?: string; status?: string; page?: number; limit?: number }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const query: Record<string, unknown> = {};
    if (filters.organizationId) query.organizationId = filters.organizationId;
    if (filters.status) query.status = filters.status;
    const [rows, total] = await Promise.all([
      this.subscriptionModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.subscriptionModel.countDocuments(query).exec(),
    ]);
    const items = await Promise.all(
      rows.map(async (row) => ({ ...(await this.toSummary(row)), organizationId: row.organizationId })),
    );
    return { items, total, page, limit };
  }

  /** Reuses the exact same soft-cancel primitive cancel() above uses
   * (cancelAtPeriodEnd=true, entitlement continues through the current
   * period, subscription-renewal.service.ts flips status at the actual
   * period end) — just callable for any org, not only the caller's own. */
  async adminCancel(subscriptionId: string): Promise<SubscriptionSummary> {
    const subscription = await this.subscriptionModel
      .findOne({ _id: subscriptionId, status: { $in: ['trialing', 'active', 'past_due'] } })
      .exec();
    if (!subscription) throw new NotFoundException('No cancelable subscription found with that id.');

    subscription.cancelAtPeriodEnd = true;
    await subscription.save();
    await this.eventModel.create({
      subscriptionId: subscription._id.toString(),
      organizationId: subscription.organizationId,
      type: 'canceled',
      metadata: { effectiveAt: subscription.currentPeriodEnd, actor: 'platform_admin' },
    });
    return this.toSummary(subscription);
  }

  /** Clears a pending cancellation while the subscription is still within
   * its current period — no-op change to billing state itself (no renewal
   * has happened, no credits move); subscription-renewal.service.ts simply
   * stops treating this subscription as due for cancellation at period end. */
  async adminReactivate(subscriptionId: string): Promise<SubscriptionSummary> {
    const subscription = await this.subscriptionModel
      .findOne({ _id: subscriptionId, status: { $in: ['trialing', 'active', 'past_due'] }, cancelAtPeriodEnd: true })
      .exec();
    if (!subscription) throw new NotFoundException('No pending-cancellation subscription found with that id.');

    subscription.cancelAtPeriodEnd = false;
    await subscription.save();
    await this.eventModel.create({
      subscriptionId: subscription._id.toString(),
      organizationId: subscription.organizationId,
      type: 'plan_changed',
      metadata: { reactivated: true, actor: 'platform_admin' },
    });
    return this.toSummary(subscription);
  }

  private async toSummary(subscription: BillingSubscriptionDocument): Promise<SubscriptionSummary> {
    const [plan, price] = await Promise.all([
      this.planModel.findById(subscription.planId).exec(),
      this.priceModel.findById(subscription.planPriceId).exec(),
    ]);
    return {
      id: subscription._id.toString(),
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      plan: plan ? { id: plan._id.toString(), key: plan.key, name: plan.name } : null,
      price: price
        ? { id: price._id.toString(), currencyCode: price.currencyCode, billingCycle: price.billingCycle, amount: price.amount, creditsGranted: price.creditsGranted }
        : null,
    };
  }
}
