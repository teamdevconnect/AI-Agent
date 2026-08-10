import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoyaltyRuleDocument = RoyaltyRule & Document<Types.ObjectId>;

@Schema({ _id: false })
export class RoyaltySlidingTier {
  @Prop({ required: true })
  fromValue: number;

  // Unset = open-ended top tier.
  @Prop()
  toValue?: number;

  @Prop({ required: true })
  percentage: number;
}
const RoyaltySlidingTierSchema = SchemaFactory.createForClass(RoyaltySlidingTier);

// Effective-dated, append-only — one doc per version, never mutated once
// live. A report for a past period must use the rule that was active THEN,
// and a real royalty % can genuinely change over the life of a franchise
// agreement; a single mutable doc would silently corrupt every historical
// report the moment anyone updates it. RoyaltyRulesService.getEffectiveRule
// resolves whichever version was actually in effect on a given date — the
// method the future calculation engine (Phase 20b) will call. A version is
// only editable via RoyaltyRulesService.updateFutureVersion while its
// effectiveDate is still in the future; once live, only a new version can
// supersede it.
@Schema({ timestamps: true, collection: 'royalty_rules' })
export class RoyaltyRule {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true })
  royaltyPercentage: number;

  @Prop({ enum: ['none', 'min', 'max', 'sliding'], default: 'none', required: true })
  capType: 'none' | 'min' | 'max' | 'sliding';

  // Single number, used only for capType 'min'/'max'.
  @Prop()
  capValue?: number;

  // Used only for capType 'sliding'.
  @Prop({ type: [RoyaltySlidingTierSchema], default: [] })
  slidingTiers: RoyaltySlidingTier[];

  @Prop()
  adminFeePercentage?: number;

  @Prop()
  techFeePercentage?: number;

  @Prop()
  marketingFeePercentage?: number;

  // ASSUMPTION, flagged for the org's admin to confirm/override on the
  // settings page: sales tax and pass-through shipping are conventionally
  // excluded from a franchisor's royalty base; a discount is assumed
  // already netted into Invoice.currentValue rather than needing a second
  // subtraction, so it defaults OFF. Not locked in — editable per org.
  @Prop({ default: true })
  excludeTax: boolean;

  @Prop({ default: true })
  excludeShipping: boolean;

  @Prop({ default: false })
  excludeDiscount: boolean;

  @Prop({ required: true, index: true })
  effectiveDate: Date;

  @Prop({ required: true })
  createdBy: string;

  createdAt: Date;
  updatedAt: Date;
}

export const RoyaltyRuleSchema = SchemaFactory.createForClass(RoyaltyRule);
RoyaltyRuleSchema.index({ organizationId: 1, effectiveDate: -1 });
