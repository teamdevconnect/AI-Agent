import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OutlookConnectionDocument = OutlookConnection & Document<Types.ObjectId>;

@Schema({ timestamps: true, collection: 'outlook_connections' })
export class OutlookConnection {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  accessToken: string;

  @Prop({ required: true })
  refreshToken: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: '' })
  scope: string;

  // The account python-agent uses when it needs to act as "the user's
  // mailbox" — a user can have several connected accounts, but exactly one
  // is active at a time. See OutlookService.setActive.
  @Prop({ default: false })
  isActive: boolean;
}

export const OutlookConnectionSchema = SchemaFactory.createForClass(OutlookConnection);
OutlookConnectionSchema.index({ userId: 1, email: 1 }, { unique: true });