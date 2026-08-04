import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CustomerActivitySummaryDocument = CustomerActivitySummary & Document<Types.ObjectId>;

// Caches the on-demand LLM result for "Generate AI Summary" on the Customer
// Activity tab — one doc per (org, store scope, date), same
// upsert-on-write convention as DailyReport, so re-opening the tab on the
// same day never re-spends an LLM call unless the caller explicitly asks
// to regenerate.
@Schema({ timestamps: true, collection: 'customer_activity_summaries' })
export class CustomerActivitySummary {
  @Prop({ required: true, index: true })
  organizationId: string;

  // Unset for an org-wide (owner/admin) summary; set for a manager's
  // store-scoped summary — mirrors DailyReport.storeId's optionality.
  @Prop()
  storeId?: string;

  // "YYYY-MM-DD" — the day this summary covers, not the moment generated.
  @Prop({ required: true, index: true })
  date: string;

  @Prop({ required: true })
  requestedByUserId: string;

  // The exact deterministic payload sent to the LLM — kept for
  // auditability/debugging, not surfaced directly in the UI.
  @Prop({ type: Object, required: true })
  deterministicInput: Record<string, unknown>;

  // The LLM's structured tool_use output (prioritization, missedImportantEmails, aiSummary).
  @Prop({ type: Object, required: true })
  result: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

export const CustomerActivitySummarySchema = SchemaFactory.createForClass(CustomerActivitySummary);
CustomerActivitySummarySchema.index({ organizationId: 1, storeId: 1, date: 1 }, { unique: true });
