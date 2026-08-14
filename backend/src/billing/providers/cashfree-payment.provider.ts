import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cashfree, CFEnvironment } from 'cashfree-pg';
import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  ChargeResult,
  ConfirmPaymentResult,
  CreateCheckoutOrderResult,
  GenericWebhookEvent,
  PaymentProviderAdapter,
  SaveMethodResult,
} from './payment-provider.interface';

const API_VERSION = '2023-08-01';

/**
 * Structurally complete Cashfree integration (Orders API, saved-instrument
 * lookup, HMAC-SHA256 webhook verification via the SDK's own
 * PGVerifyWebhookSignature). Falls back to simulated success when the
 * active mode's client id/secret aren't configured, same shape as
 * RazorpayPaymentProvider/StripePaymentProvider.
 *
 * config.billing.cashfree.env overrides live/test -> PRODUCTION/SANDBOX
 * mapping if a deployment ever needs to decouple the two; defaults to
 * following config.billing.paymentMode like every other gateway here.
 */
@Injectable()
export class CashfreePaymentProvider implements PaymentProviderAdapter {
  readonly providerKey = 'cashfree' as const;
  private readonly logger = new Logger(CashfreePaymentProvider.name);
  private readonly configured: boolean;
  private readonly client?: Cashfree;
  private readonly webhookSecret: string;

  constructor(
    private config: ConfigService,
    private encryption: EncryptionService,
  ) {
    const mode = this.config.get<'live' | 'test'>('billing.paymentMode') ?? 'test';
    const keys = this.config.get<{ clientId: string; clientSecret: string; webhookSecret: string }>(`billing.cashfree.${mode}`);
    const clientId = keys?.clientId ?? '';
    const clientSecret = keys?.clientSecret ?? '';
    this.webhookSecret = keys?.webhookSecret ?? '';
    this.configured = Boolean(clientId && clientSecret);

    if (!this.configured) {
      this.logger.warn(
        `Cashfree ${mode}-mode keys not set (CASHFREE_CLIENT_ID${mode === 'test' ? '_TEST' : ''}/CASHFREE_CLIENT_SECRET${mode === 'test' ? '_TEST' : ''}) — ` +
          'running in simulated payment mode. Purchases and AutoPay recharges will succeed instantly without contacting Cashfree.',
      );
    } else {
      const envOverride = this.config.get<string>('billing.cashfree.env');
      const environment =
        envOverride === 'PRODUCTION' || (!envOverride && mode === 'live') ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
      this.client = new Cashfree(environment, clientId, clientSecret);
      this.client.XApiVersion = API_VERSION;
    }
  }

  async createCustomer(organizationId: string, email: string, name: string): Promise<{ customerId: string }> {
    const customerId = `org_${organizationId}`;
    if (!this.configured || !this.client) {
      return { customerId };
    }
    // Cashfree has no standalone "create customer" concept the way
    // Razorpay/Stripe do — a customer is implicitly created/updated as
    // part of order creation (see createCheckoutOrder's customer_details).
    // Returning a stable, deterministic id here (rather than calling any
    // API) keeps this method meaningful without a real network call.
    void email;
    void name;
    return { customerId };
  }

  async createCheckoutOrder(
    organizationId: string,
    amount: number,
    currency: string,
    creditPackageKey: string,
  ): Promise<CreateCheckoutOrderResult> {
    if (!this.configured || !this.client) {
      const orderId = `sim_order_${randomUUID()}`;
      return { orderId, simulated: true, checkoutParams: { orderId, amount, currency, simulated: true } };
    }

    const orderId = `order_${organizationId}_${creditPackageKey}_${Date.now()}`;
    const response = await this.client.PGCreateOrder({
      order_id: orderId,
      order_amount: amount,
      order_currency: currency,
      customer_details: {
        customer_id: `org_${organizationId}`,
        customer_email: `billing+${organizationId}@haive.internal`,
        customer_phone: '9999999999',
      },
      order_meta: { return_url: undefined },
    } as never);
    const sessionId = (response.data as unknown as { payment_session_id?: string }).payment_session_id;
    return {
      orderId,
      simulated: false,
      checkoutParams: { orderId, paymentSessionId: sessionId, amount, currency, simulated: false },
    };
  }

  async saveMethodFromCheckout(
    organizationId: string,
    gatewayCustomerId: string,
    gatewayPaymentId: string,
    _signature: string,
    gatewayOrderId: string,
  ): Promise<SaveMethodResult> {
    if (!this.configured || !this.client) {
      const tokenId = `sim_token_${randomUUID()}`;
      return {
        paymentMethodId: tokenId,
        gatewayCustomerId,
        gatewayTokenIdEncrypted: this.encryption.encrypt(tokenId),
        cardLast4: '0000',
        cardNetwork: 'simulated',
      };
    }

    const payments = await this.client.PGOrderFetchPayments(gatewayOrderId);
    const payment = (payments.data as unknown as { cf_payment_id?: string; payment_method?: { card?: { card_last4?: string; card_network?: string } } }[]).find(
      (p) => String(p.cf_payment_id) === gatewayPaymentId,
    );
    const card = payment?.payment_method?.card;
    // Cashfree's saved-instrument id is fetched separately per customer
    // (PGCustomerFetchInstruments) rather than returned inline on the
    // payment — using the payment id itself as the reference token here is
    // the documented fallback when instrument tokenization wasn't
    // explicitly requested at checkout.
    const tokenId = gatewayPaymentId;
    return {
      paymentMethodId: tokenId,
      gatewayCustomerId: `org_${organizationId}`,
      gatewayTokenIdEncrypted: this.encryption.encrypt(tokenId),
      cardLast4: card?.card_last4 ?? '0000',
      cardNetwork: card?.card_network ?? 'unknown',
    };
  }

  async chargeSavedMethod(
    organizationId: string,
    gatewayCustomerId: string,
    gatewayTokenId: string,
    amount: number,
    currency: string,
  ): Promise<ChargeResult> {
    if (!this.configured || !this.client) {
      return { success: true, paymentId: `sim_pay_${randomUUID()}`, simulated: true };
    }

    try {
      const orderId = `autopay_${organizationId}_${Date.now()}`;
      const order = await this.client.PGCreateOrder({
        order_id: orderId,
        order_amount: amount,
        order_currency: currency,
        customer_details: { customer_id: gatewayCustomerId, customer_email: `billing+${organizationId}@haive.internal`, customer_phone: '9999999999' },
      } as never);
      const paymentResult = await this.client.PGPayOrder({
        order_id: orderId,
        order_amount: amount,
        order_currency: currency,
        payment_method: { card: { channel: 'link', card_token: gatewayTokenId } },
      } as never);
      void order;
      const paymentId = (paymentResult.data as unknown as { cf_payment_id?: string }).cf_payment_id ?? orderId;
      return { success: true, paymentId: String(paymentId), simulated: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cashfree charge failed';
      return { success: false, paymentId: '', simulated: false, reason: message };
    }
  }

  async confirmPayment(gatewayOrderId: string, _gatewayPaymentId: string, _signature: string): Promise<ConfirmPaymentResult> {
    if (!this.configured || !this.client) {
      return { success: true };
    }
    // Cashfree has no client-relayed signature for this either — re-fetch
    // the order directly from Cashfree's own API and trust only its
    // reported order_status.
    try {
      const order = await this.client.PGFetchOrder(gatewayOrderId);
      const status = (order.data as unknown as { order_status?: string }).order_status;
      if (status !== 'PAID') {
        return { success: false, reason: `Order status is "${status}", not PAID` };
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not fetch order status';
      return { success: false, reason: message };
    }
  }

  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string, headers?: Record<string, string>): boolean {
    const timestamp = headers?.['x-webhook-timestamp'] ?? '';
    if (!this.configured || !this.client || !this.webhookSecret) {
      return true; // simulated mode — nothing signs these payloads for real
    }
    try {
      this.client.PGVerifyWebhookSignature(signatureHeader, rawBody.toString('utf8'), timestamp);
      return true;
    } catch {
      return false;
    }
  }

  parseWebhookEvent(rawBody: Buffer): GenericWebhookEvent {
    const payload = JSON.parse(rawBody.toString('utf8')) as {
      type?: string;
      data?: { order?: { order_id?: string }; payment?: { cf_payment_id?: string; payment_status?: string } };
    };
    const type = payload.type ?? 'unknown';
    const normalizedEvent =
      type === 'PAYMENT_SUCCESS_WEBHOOK' ? 'payment.captured' : type === 'PAYMENT_FAILED_WEBHOOK' ? 'payment.failed' : type;
    return {
      eventId: `${payload.data?.order?.order_id ?? 'unknown'}_${payload.data?.payment?.cf_payment_id ?? randomUUID()}`,
      event: normalizedEvent,
      gatewayOrderId: payload.data?.order?.order_id,
      gatewayPaymentId: payload.data?.payment?.cf_payment_id ? String(payload.data.payment.cf_payment_id) : undefined,
      raw: payload,
    };
  }
}
