import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CreditPackageDocument = CreditPackage & Document<Types.ObjectId>;

// Config-driven purchase packages ($5→500 credits, $20→2000, ...) — never
// hardcoded in frontend components. Platform-global (no organizationId) for
// v1; per-org custom packages are a scope cut (see plan).
@Schema({ timestamps: true, collection: 'credit_packages' })
export class CreditPackage {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  credits: number;

  @Prop({ default: 0 })
  bonusCredits: number;

  @Prop({ required: true })
  price: number;

  // ISO 4217, e.g. 'INR'/'USD' — matches config.billing.currency at the
  // time this package was seeded/created; not re-derived at read time, so
  // changing the platform default currency later doesn't silently
  // reinterpret an existing package's already-set price.
  @Prop({ required: true })
  currency: string;

  @Prop({ default: true, index: true })
  active: boolean;

  @Prop({ default: 0 })
  sortOrder: number;
}

export const CreditPackageSchema = SchemaFactory.createForClass(CreditPackage);
