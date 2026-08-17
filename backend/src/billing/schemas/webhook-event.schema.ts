import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WebhookEventDocument = WebhookEvent & Document<Types.ObjectId>;

// The idempotency anchor for payment webhooks. A duplicate delivery of the
// same event (Razorpay's x-razorpay-event-id header) hits a Mongo
// duplicate-key error on insert and is dropped before any processing —
// deliberately isolated in its own tiny collection rather than overloaded
// onto PaymentRecord's own mutable status, so it stays correct even if
// PaymentRecord's update logic changes later.
@Schema({ timestamps: { createdAt: 'receivedAt', updatedAt: false }, collection: 'webhook_events' })
export class WebhookEvent {
  @Prop({ required: true, unique: true })
  eventId: string;

  @Prop({ required: true, default: 'razorpay' })
  provider: 'razorpay';

  @Prop({ type: Object, required: true })
  payload: Record<string, unknown>;

  @Prop()
  receivedAt: Date;
}

export const WebhookEventSchema = SchemaFactory.createForClass(WebhookEvent);
