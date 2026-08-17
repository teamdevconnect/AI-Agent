import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ApiTokenDocument = ApiToken & Document<Types.ObjectId>;

// Separate top-level collection (unlike sessions/push-subscriptions, which
// are embedded on User) — tokens are many-per-user with an independent
// lifecycle worth its own audit trail, matching IntegrationCredential's
// precedent more than the auth-adjacent OTP-style fields on User.
@Schema({ timestamps: true, collection: 'api_tokens' })
export class ApiToken {
  @Prop({ required: true, index: true })
  userId: string;

  // Not used for access control (tokens are strictly per-user, see
  // ApiTokensService) — kept for a possible future org-wide audit view.
  @Prop({ required: true })
  organizationId: string;

  @Prop({ required: true, trim: true })
  name: string;

  // First ~12 chars of the issued token (e.g. "pat_Ax7f2k9Q") — shown in the
  // UI list so a user can tell tokens apart without ever seeing the rest
  // again after creation.
  @Prop({ required: true })
  prefix: string;

  // SHA-256 hex digest of the full token, not bcrypt — every authenticated
  // request needs an indexed lookup by hash to identify which token it is;
  // bcrypt's per-call random salt makes that impossible (see
  // JwtAuthGuard's PAT branch). The secret itself is a high-entropy
  // server-generated random value, not a human-chosen one, so bcrypt's
  // deliberate slowness defends against nothing here.
  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop()
  lastUsedAt?: Date;

  // No default expiry — a real, if discouraged, choice matches common PAT
  // UX (GitHub/GitLab both allow "no expiration").
  @Prop()
  expiresAt?: Date;

  // Soft-delete kept (unlike sessions' hard $pull) — tokens are lower-churn
  // and "this token existed, was revoked on X" has real audit value.
  @Prop()
  revokedAt?: Date;
}

export const ApiTokenSchema = SchemaFactory.createForClass(ApiToken);
ApiTokenSchema.index({ userId: 1, revokedAt: 1 });
