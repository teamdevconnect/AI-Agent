import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FinanceSummaryDocument = FinanceSummary & Document<Types.ObjectId>;

// The Finance AI equivalent of crm/schemas/customer-activity-summary.schema.ts
// — caches the on-demand LLM result for "Generate AI Summary" on the
// Finance Overview tab. No storeId/userId dimension: Finance is confirmed
// organization-level-only (finance-document.schema.ts has no storeId field
// at all, RBAC is owner/admin-only), so one cache doc per org per day.
@Schema({ timestamps: true, collection: 'finance_summaries' })
export class FinanceSummary {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, index: true })
  date: string;

  @Prop({ required: true })
  requestedByUserId: string;

  @Prop({ type: Object, required: true })
  deterministicInput: Record<string, unknown>;

  @Prop({ type: Object, required: true })
  result: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

export const FinanceSummarySchema = SchemaFactory.createForClass(FinanceSummary);
FinanceSummarySchema.index({ organizationId: 1, date: 1 }, { unique: true });
