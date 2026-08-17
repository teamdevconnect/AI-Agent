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

  // Lets the admin-only GET /audit-logs viewer show only the caller's own
  // org's activity instead of the entire deployment's — optional because
  // requests that fail JWT auth entirely (never reach a valid `request.user`)
  // still get logged with userId 'anonymous' and no org to attach.
  @Prop({ index: true })
  organizationId?: string;

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

  // Optional, only ever set by the small number of explicit
  // AuditService.log() calls made directly from application code (e.g.
  // AuthService.changePassword, TwoFactorService.enable/disable) for
  // actions that live under /auth and are therefore skipped by the
  // interceptor below — every interceptor-auto-logged entry omits these,
  // exactly as before this field existed.
  @Prop()
  action?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
