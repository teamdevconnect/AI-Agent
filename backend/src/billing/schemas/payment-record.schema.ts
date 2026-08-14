import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PaymentProviderKey } from '../providers/payment-provider.interface';

export type PaymentRecordDocument = PaymentRecord & Document<Types.ObjectId>;

// One row per purchase or AutoPay recharge attempt, against whichever
// gateway was active at the time (see PaymentProviderKey) — a deployment
// that switches ACTIVE_PAYMENT_PROVIDER mid-flight ends up with rows from
// more than one gateway in this same collection, which `provider` disambiguates.
// gatewayOrderId is unique so a retried/duplicated order-creation call can
// never produce two rows for the same order; gatewayPaymentId is
// unique-sparse (absent until a payment actually completes).
@Schema({ timestamps: true, collection: 'payment_records' })
export class PaymentRecord {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true })
  walletId: string;

  @Prop({ required: true, enum: ['purchase', 'autopay'] })
  type: 'purchase' | 'autopay';

  @Prop({ required: true, enum: ['razorpay', 'stripe', 'cashfree'], index: true })
  provider: PaymentProviderKey;

  // Absent for 'autopay' rows — Auto Recharge tops up to a target balance
  // (see wallet.schema.ts's AutoPaySettings), it isn't tied to any
  // CreditPackage the way a customer-initiated purchase is.
  @Prop()
  creditPackageId?: string;

  @Prop({ required: true, unique: true })
  gatewayOrderId: string;

  @Prop({ unique: true, sparse: true })
  gatewayPaymentId?: string;

  @Prop()
  gatewaySignature?: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  currency: string;

  @Prop({ required: true })
  creditsGranted: number;

  @Prop({ required: true, enum: ['created', 'authorized', 'captured', 'failed', 'refunded'], default: 'created', index: true })
  status: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';

  // True when this payment never touched the real gateway API — the
  // adapter simulated success because that gateway's keys aren't
  // configured yet. Kept visible (not hidden) so the admin console can
  // distinguish real revenue from dev-mode simulated activity.
  @Prop({ default: false })
  simulated: boolean;

  @Prop({ type: Object })
  rawWebhookPayload?: Record<string, unknown>;
}

export const PaymentRecordSchema = SchemaFactory.createForClass(PaymentRecord);
