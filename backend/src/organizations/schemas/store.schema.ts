import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StoreDocument = Store & Document<Types.ObjectId>;

// Absorbs what used to be the single global StoreSettings document — one
// Store per physical location, scoped to its organization. Every org gets a
// default store created alongside it at registration (see
// OrganizationsService.createOrganizationWithOwner); more can be added later
// once a multi-store management UI exists (Phase 3+).
@Schema({ timestamps: true, collection: 'stores' })
export class Store {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop()
  address?: string;

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

export const StoreSchema = SchemaFactory.createForClass(Store);
