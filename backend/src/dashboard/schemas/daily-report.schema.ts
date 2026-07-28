import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DailyReportDocument = DailyReport & Document<Types.ObjectId>;

// _id defaults to true (Mongoose auto-generates one per subdocument) — this
// is what makes a task individually addressable for PATCH /tasks/:id
// (the To-Do/EOD Trello board), not just an array-index-only embedded item.
@Schema()
export class DailyReportTask {
  _id: Types.ObjectId;

  @Prop({ required: true }) title: string;
  @Prop({ required: true, enum: ['urgent', 'high', 'medium', 'low'] })
  priority: 'urgent' | 'high' | 'medium' | 'low';
  @Prop() category?: string;
  @Prop({ default: false }) isOverdue: boolean;
  // Workflow progress — orthogonal to priority/isOverdue (urgency metadata).
  // Moving a task to 'done' never touches isOverdue/priority.
  @Prop({ required: true, enum: ['todo', 'in_progress', 'done'], default: 'todo' })
  status: 'todo' | 'in_progress' | 'done';
}
const DailyReportTaskSchema = SchemaFactory.createForClass(DailyReportTask);

// Structured counterpart to the free-form chat conversations the scheduled
// morning/EOD job already creates per user — one doc per (agentId,
// reportType, date), not one per user, so the dashboard shows a single
// business-wide status per agent rather than N duplicate rows. NestJS owns
// all writes here (python-agent only structures text, doesn't persist).
@Schema({ timestamps: true, collection: 'daily_reports' })
export class DailyReport {
  @Prop({ required: true, index: true }) agentId: string;
  @Prop({ required: true, enum: ['morning', 'eod'] }) reportType: 'morning' | 'eod';
  @Prop({ required: true, index: true }) date: string; // "YYYY-MM-DD"

  @Prop({ type: [DailyReportTaskSchema], default: [] }) tasks: DailyReportTask[];
  @Prop({ default: '' }) summary: string;

  @Prop({ required: true }) sourceConversationId: string;
  // Audit only — whose reply was structured (see store-settings.service.ts's
  // "first successful user" selection for the exactly-once-per-day design).
  @Prop({ required: true }) sourceUserId: string;

  createdAt: Date;
  updatedAt: Date;
}

export const DailyReportSchema = SchemaFactory.createForClass(DailyReport);
DailyReportSchema.index({ agentId: 1, reportType: 1, date: 1 }, { unique: true });
