import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EmailFollowUpReminderDocument = EmailFollowUpReminder & Document<Types.ObjectId>;

// Phase 14e — a small, dedicated schema for post-send follow-up reminders.
// Deliberately NOT an insert into DailyReport.tasks: that array is
// wholesale-replaced by DashboardService.recordDailyReport() on every
// scheduled morning/EOD report generation, which would silently wipe an
// ad-hoc reminder the next time a report runs for the same
// (organizationId, storeId, agentId, reportType, date) key.
@Schema({ timestamps: true, collection: 'email_follow_up_reminders' })
export class EmailFollowUpReminder {
  @Prop({ required: true, index: true })
  organizationId: string;

  // Self-scope key — the salesperson who sent the reply this reminder
  // follows up on.
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  emailIntelligenceItemId: string;

  @Prop()
  businessName?: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  dueDate: Date;

  @Prop({ enum: ['pending', 'done', 'dismissed'], default: 'pending', index: true })
  status: 'pending' | 'done' | 'dismissed';

  createdAt: Date;
  updatedAt: Date;
}

export const EmailFollowUpReminderSchema = SchemaFactory.createForClass(EmailFollowUpReminder);
EmailFollowUpReminderSchema.index({ userId: 1, status: 1, dueDate: 1 });
