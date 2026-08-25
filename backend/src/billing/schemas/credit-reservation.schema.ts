import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CreditReservationDocument = CreditReservation & Document<Types.ObjectId>;

// One row per in-flight chat turn's pre-authorization. requestId is minted
// by python-agent's routes/chat.py before it calls run_agent() and is
// threaded through every traced_llm_call site touched during that turn
// (see tracing.py/execution_store.py) — settlement sums agent_executions
// rows matching this requestId to compute the real charge.
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'credit_reservations' })
export class CreditReservation {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, index: true })
  walletId: string;

  @Prop({ required: true, unique: true })
  requestId: string;

  @Prop({ required: true, index: true })
  conversationId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  estimatedCredits: number;

  @Prop({ required: true, enum: ['pending', 'settled', 'released'], default: 'pending', index: true })
  status: 'pending' | 'settled' | 'released';

  @Prop()
  settledCredits?: number;

  @Prop()
  createdAt: Date;

  @Prop()
  settledAt?: Date;

  @Prop()
  releasedAt?: Date;

  // createdAt + config.billing.reservationTimeoutMinutes — backs the cron
  // sweeper (ReservationService) that force-releases a reservation if
  // python-agent crashes mid-turn without ever calling settle or release.
  @Prop({ required: true, index: true })
  expiresAt: Date;
}

export const CreditReservationSchema = SchemaFactory.createForClass(CreditReservation);
CreditReservationSchema.index({ organizationId: 1, status: 1 });
CreditReservationSchema.index({ organizationId: 1, createdAt: -1 });
