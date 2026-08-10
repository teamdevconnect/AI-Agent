import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EmailSyncJobDocument = EmailSyncJob & Document<Types.ObjectId>;

// A history collection for the sync button's own audit trail — same spirit
// as workflows/schemas/workflow-execution.schema.ts, not a queryable
// business object. One doc per real (non-preview) POST /email-intelligence/
// sync execution. Written best-effort at the end of
// EmailIntelligenceSyncService.syncMyMailbox — a failure to write this doc
// must never fail the sync response itself (see that method's own comment).
@Schema({ timestamps: true, collection: 'email_sync_jobs' })
export class EmailSyncJob {
  @Prop({ required: true, index: true })
  organizationId: string;

  // Self-scope key — matches this module's established self-scoped-only
  // stance (see EmailIntelligenceController's class comment).
  @Prop({ required: true, index: true })
  userId: string;

  // Phase 21 follow-up — 'completed_with_errors' distinguishes "the sync
  // ran end-to-end but some/all items failed" (e.g. a real Anthropic outage)
  // from a genuinely clean run, so the history list never shows a run with
  // 10/10 failures as plain "completed". 'failed' stays reserved for the
  // sync operation itself throwing before finishing (see syncMyMailbox's own
  // outer catch) — a materially different, rarer case. No QUEUED/RUNNING/
  // CANCELLED states: this stays a fully synchronous, click-and-wait
  // operation, not a queue, so those states wouldn't correspond to anything
  // real yet (see Phase 21 follow-up plan notes for why that was scoped out).
  @Prop({ required: true, enum: ['completed', 'completed_with_errors', 'failed'] })
  status: 'completed' | 'completed_with_errors' | 'failed';

  @Prop({ required: true, default: 0 })
  scannedCount: number;

  @Prop({ required: true, default: 0 })
  newItemsCount: number;

  @Prop({ required: true, default: 0 })
  succeededCount: number;

  @Prop({ required: true, default: 0 })
  failedCount: number;

  @Prop({ required: true, enum: ['user'], default: 'user' })
  triggeredBy: 'user';

  @Prop({ required: true })
  startedAt: Date;

  @Prop({ required: true })
  completedAt: Date;
}

export const EmailSyncJobSchema = SchemaFactory.createForClass(EmailSyncJob);
EmailSyncJobSchema.index({ userId: 1, createdAt: -1 });
