import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GmailConnectionDocument = GmailConnection & Document<Types.ObjectId>;

// Identical shape to outlook/schemas/outlook-connection.schema.ts — a
// parallel schema, not a shared provider-discriminated one, matching how
// Outlook's own schema/service have zero provider-parameterization to
// build on (see Phase 8 plan notes).
@Schema({ timestamps: true, collection: 'gmail_connections' })
export class GmailConnection {
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
  // is active at a time. See GmailService.setActive.
  @Prop({ default: false })
  isActive: boolean;
}

export const GmailConnectionSchema = SchemaFactory.createForClass(GmailConnection);
GmailConnectionSchema.index({ userId: 1, email: 1 }, { unique: true });
