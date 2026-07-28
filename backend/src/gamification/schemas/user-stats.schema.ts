import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserStatsDocument = UserStats & Document;

@Schema({ timestamps: true, collection: 'user_stats' })
export class UserStats {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop({ default: 0 })
  tasksCompleted: number;

  @Prop({ default: 0 })
  overdueCleared: number;

  @Prop({ default: 0 })
  points: number;

  @Prop({ default: 0 })
  currentStreak: number;

  @Prop({ default: 0 })
  longestStreak: number;

  // "YYYY-MM-DD" of the last day at least one task was completed — streak
  // math compares this to today/yesterday rather than storing every
  // completion timestamp.
  @Prop()
  lastCompletionDate?: string;

  @Prop({ type: [String], default: [] })
  unlockedAchievements: string[];
}

export const UserStatsSchema = SchemaFactory.createForClass(UserStats);
