import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OutlookConnectionDocument = OutlookConnection & Document<Types.ObjectId>;

@Schema({ timestamps: true, collection: 'outlook_connections' })
export class OutlookConnection {
  @Prop({ required: true, index: true })
  userId: string;

  // Optional — absent on every connection made before org-level account
  // visibility existed. Backfilled going forward at connect time
  // (OutlookService.handleCallback); existing rows keep working unchanged
  // for every userId-scoped query (getStatus/listAccounts/setActive/
  // disconnect), which never filter on this field.
  @Prop({ index: true })
  organizationId?: string;

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

  // Set to 'needs_reauth' by python-agent (see outlook_store.py's _refresh)
  // the moment a refresh attempt comes back invalid_grant — the user
  // revoked access or changed their Microsoft password, and no amount of
  // retrying fixes it without them reconnecting through the consent screen
  // again. Absent/'connected' on every row written before this existed;
  // isActive is untouched either way, so which mailbox is "the active one"
  // keeps meaning what it always did.
  @Prop({ default: 'connected' })
  status?: 'connected' | 'needs_reauth';
}

export const OutlookConnectionSchema = SchemaFactory.createForClass(OutlookConnection);
OutlookConnectionSchema.index({ userId: 1, email: 1 }, { unique: true });