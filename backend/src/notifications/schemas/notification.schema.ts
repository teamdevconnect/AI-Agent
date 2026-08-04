import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document<Types.ObjectId>;

// Matches the frontend's NotificationKind exactly (frontend/src/services/mock/fixtures/notifications.ts) —
// the frontend's mock fixtures were the only definition of this shape before this schema existed.
export const NOTIFICATION_KINDS = ['system', 'integration', 'warning', 'error'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ required: true })
  userId: string;

  // Optional: userId alone already isolates this by owner (a user's id is
  // unique across the whole deployment), so this doesn't gate access — it's
  // here so a future org-wide view (AI Timeline, admin notification audit)
  // doesn't have to resolve userId -> organizationId for every row. Not
  // every creation path has an org in hand (e.g. gamification's
  // recordTaskCompletion only has a userId), so this stays optional rather
  // than forcing a lookup on every write.
  @Prop()
  organizationId?: string;

  @Prop({ required: true, enum: NOTIFICATION_KINDS })
  kind: NotificationKind;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ default: false })
  read: boolean;

  // Set when python-agent's Planner/workflows created this proactively, with
  // no live user turn behind it (see python-agent/app/notifications/client.py)
  // — e.g. "workflow:crm_follow_up_check". Absent for anything created via a
  // live authenticated request.
  @Prop()
  source?: string;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
