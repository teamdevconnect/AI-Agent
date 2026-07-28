import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

// Deliberately no request body/response content — only who did what, to
// which route, with what outcome. Logging bodies would risk capturing
// credentials (integration API keys, passwords) even with the auth routes
// excluded (see AuditInterceptor's SKIP_ROUTES) — this is the accountability
// trail, not a request replay log.
@Schema({ timestamps: true, collection: 'audit_logs' })
export class AuditLog {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  method: string;

  @Prop({ required: true, index: true })
  route: string;

  @Prop({ required: true })
  statusCode: number;

  @Prop({ required: true })
  durationMs: number;

  @Prop()
  ip?: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
