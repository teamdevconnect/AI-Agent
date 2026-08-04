import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TimelineEventDocument = TimelineEvent & Document<Types.ObjectId>;

// Deliberately a plain string, not a Mongo enum — Phase 7's workflow-engine
// events (and whatever else shows up later) can be added without a schema
// migration. The known values today: 'daily_report_generated',
// 'daily_report_missed', 'task_completed', 'achievement_unlocked'.
export type TimelineEventType = string;

// The business's "memory" — significant events worth remembering, distinct
// from audit/audit-log.schema.ts (HTTP-request-level accountability trail).
@Schema({ timestamps: true, collection: 'timeline_events' })
export class TimelineEvent {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ index: true })
  storeId?: string;

  @Prop({ index: true })
  userId?: string;

  @Prop({ required: true, index: true })
  type: TimelineEventType;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  sourceType: string;

  @Prop()
  sourceId?: string;

  // The event's real-world moment — for a backfilled/missed scheduled job,
  // this is the ORIGINAL scheduled instant, not when it was actually
  // generated. That's what "preserving the original scheduled date and
  // time" means: the Timeline shows what should have happened when, not
  // when the system got around to it.
  @Prop({ required: true, index: true })
  occurredAt: Date;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const TimelineEventSchema = SchemaFactory.createForClass(TimelineEvent);
