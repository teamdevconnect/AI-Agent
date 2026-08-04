import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CustomerActivityPersonalSummaryDocument = CustomerActivityPersonalSummary & Document<Types.ObjectId>;

// A consultant's own personal-scoped equivalent of CustomerActivitySummary —
// a deliberately separate collection (not a widened key on the org/store
// one) so the already-shipped org/store cache read/write paths stay
// completely untouched. See customer-activity.service.ts's
// getPersonalOverview/generatePersonalSummary.
@Schema({ timestamps: true, collection: 'customer_activity_personal_summaries' })
export class CustomerActivityPersonalSummary {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  date: string;

  // Always === userId today (self-only, no owner/admin override) — kept as
  // its own field for audit/parity with CustomerActivitySummary's shape.
  @Prop({ required: true })
  requestedByUserId: string;

  @Prop({ type: Object, required: true })
  deterministicInput: Record<string, unknown>;

  @Prop({ type: Object, required: true })
  result: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

export const CustomerActivityPersonalSummarySchema = SchemaFactory.createForClass(CustomerActivityPersonalSummary);
CustomerActivityPersonalSummarySchema.index({ organizationId: 1, userId: 1, date: 1 }, { unique: true });
