import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WalletDocument = Wallet & Document<Types.ObjectId>;

// "Auto Recharge" in every customer-facing string (matches OpenAI's API
// billing terminology, which this was modeled after) — kept as `autoPay`
// internally since renaming every identifier across the module for a pure
// copy change isn't worth the churn/risk.
//
// Fixed threshold + fixed recharge amount: when balanceCredits drops to
// thresholdCredits or below, AutoPayService charges exactly
// rechargeAmountCredits — a flat amount, not a computed gap to a target
// balance. See AutoPayService.attemptRecharge for the actual trigger.
export class AutoPaySettings {
  @Prop({ default: false })
  enabled: boolean;

  @Prop({ default: 200 })
  thresholdCredits: number;

  @Prop({ default: 2000 })
  rechargeAmountCredits: number;

  @Prop()
  paymentMethodId?: string;

  // Reserved for a fast-follow (see plan's scope cuts) — not enforced yet.
  @Prop()
  dailyCapCredits?: number;

  @Prop()
  monthlyCapCredits?: number;

  @Prop()
  lastTriggeredAt?: Date;

  @Prop({ default: 0 })
  consecutiveFailures: number;
}

// One wallet per organization — a separate collection from Organization
// itself (not a field on organization.schema.ts) because a wallet is
// written on nearly every chat turn (reserve/settle) while Organization is
// low-frequency tenant metadata; mixing them would create write contention
// on a document many unrelated code paths touch.
//
// balanceCredits is the settled/owned balance; reservedCredits is the sum
// of currently-pending CreditReservations. "Available to spend" is always
// `balanceCredits - reservedCredits`, computed on read — never stored, so
// there's only one number that can ever drift from the ledger truth.
@Schema({ timestamps: true, collection: 'wallets' })
export class Wallet {
  @Prop({ required: true, unique: true, index: true })
  organizationId: string;

  @Prop({ required: true, default: 0 })
  balanceCredits: number;

  @Prop({ required: true, default: 0 })
  reservedCredits: number;

  // Org-specific override of config.billing.lowBalanceThresholdCredits;
  // undefined means "use the platform default".
  @Prop()
  lowBalanceThresholdCredits?: number;

  @Prop({ type: AutoPaySettings, default: () => ({}) })
  autoPay: AutoPaySettings;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);
