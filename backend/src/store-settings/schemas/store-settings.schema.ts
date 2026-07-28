import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StoreSettingsDocument = StoreSettings & Document<Types.ObjectId>;

// Business-wide, single-document collection (no userId) — same shape as
// IntegrationCredential: one store, one set of operating hours, shared by
// everyone using this deployment.
@Schema({ timestamps: true, collection: 'store_settings' })
export class StoreSettings {
  @Prop({ default: '09:00' })
  openingTime: string; // "HH:mm", 24h, interpreted in `timezone` below

  @Prop({ default: '18:00' })
  closingTime: string;

  // IANA zone (e.g. "Asia/Kolkata") the opening/closing times above are
  // wall-clock times in — NOT the server process's local timezone, which
  // can't be relied on (defaults to UTC in most container deployments).
  @Prop({ default: 'Asia/Kolkata' })
  timezone: string;

  // Dedupe stamps ("YYYY-MM-DD") so the fixed-cadence cron checker doesn't
  // re-fire the same day's report on every tick within the trigger window.
  @Prop()
  lastMorningRunDate?: string;

  @Prop()
  lastEodRunDate?: string;
}

export const StoreSettingsSchema = SchemaFactory.createForClass(StoreSettings);
