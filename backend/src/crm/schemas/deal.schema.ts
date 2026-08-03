import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DealDocument = Deal & Document<Types.ObjectId>;

// stageId (pipeline position) and dealStatus (open/won/lost) are deliberately
// separate fields, not one — matches the dual-axis vocabulary python-agent's
// crm_deal_tool/sales_consultant persona already use.
@Schema({ timestamps: true, collection: 'crm_deals' })
export class Deal {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop()
  storeId?: string;

  // The sales rep this deal is assigned to — drives per-consultant
  // achievement % (see sales-analytics.service.ts).
  @Prop({ index: true })
  ownerId?: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  contactId?: string;

  // Set only for deals mirrored in from an org's connected external CRM
  // (see python-agent/app/integrations/crm_mongo_sync.py) — the external
  // record's own id, so re-syncing updates the same document instead of
  // duplicating it. Absent for deals created natively.
  @Prop()
  externalId?: string;

  @Prop()
  accountId?: string;

  @Prop({ index: true })
  pipelineId?: string;

  @Prop()
  stageId?: string;

  @Prop({ enum: ['open', 'won', 'lost'], default: 'open' })
  dealStatus: 'open' | 'won' | 'lost';

  @Prop({ default: 0 })
  monetaryValue: number;

  // "YYYY-MM-DD" — also doubles as the period-attribution date for sales
  // analytics (a won deal counts toward the month it was expected to close).
  @Prop()
  expectedClosingDate?: string;

  // Phase 9a: manual-entry-only dimension fields for the Deal Performance
  // dashboard. crm_mongo_sync.py never populates these (the external CRM
  // doesn't expose them) — only natively created/edited deals carry real
  // values. Plain strings, not Mongoose `enum`, so a new category later
  // needs no schema migration (vocabulary is enforced at the DTO layer).
  @Prop()
  leadSource?: string;

  // Free-text, not a catalog relation — this app has no real product
  // catalog to link against (crm.service.ts's listProducts() is a stub).
  @Prop()
  product?: string;

  @Prop()
  customerType?: string;

  @Prop()
  region?: string;

  // Schema lands in Phase 9a; the capture dropdown UI and AI-inference
  // fallback land in Phase 9b — added together now so 9b needs no schema
  // migration of its own.
  @Prop()
  lostReason?: string;

  @Prop({ enum: ['rep_reported', 'ai_inferred'] })
  lostReasonSource?: 'rep_reported' | 'ai_inferred';

  // Set only by crm_mongo_sync.py, only when a genuine field value actually
  // changed (or the deal is newly synced) — NOT bumped on every unchanged
  // re-poll, since that sync writes via raw pymongo and never touches
  // Mongoose's own `updatedAt`. customer-activity.service.ts reads
  // `lastActivityAt ?? updatedAt` as its "when was this really touched"
  // signal: natively-created/edited deals (never synced) correctly fall
  // back to real Mongoose updatedAt; synced deals get accurate change-based
  // tracking instead of a blanket "always looks fresh" or "always looks
  // stale" false signal.
  @Prop()
  lastActivityAt?: Date;

  // Managed automatically by { timestamps: true } above — declared (not
  // @Prop()'d) purely so TypeScript knows these exist, same convention
  // DailyReport already uses. Phase 11's customer-activity.service.ts reads
  // these directly to determine "actioned today" / "new business".
  createdAt: Date;
  updatedAt: Date;
}

export const DealSchema = SchemaFactory.createForClass(Deal);
// One native Mongo doc per external deal per org. `sparse` alone does NOT
// achieve this for a COMPOUND index — Mongo only excludes a document from a
// sparse compound index when ALL of its fields are missing, and
// organizationId is never missing, so a plain `sparse: true` here silently
// allowed only ONE native (externalId-less) deal per org before ever
// colliding (found live during Phase 9a's create-endpoint verification,
// dormant since Phase 2). `partialFilterExpression` is the correct
// primitive: it excludes any document lacking externalId from the index
// entirely, regardless of what else is missing.
DealSchema.index(
  { organizationId: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $exists: true } } },
);
