import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document<Types.ObjectId>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  // Optional now — an account created via "Sign in with Google/Microsoft/
  // GitHub" (see AuthService.loginWithOAuth) has no password at all until
  // the user explicitly sets one. Every password-path call site (login,
  // reset-password) already has to check truthiness of this before
  // bcrypt.compare, since bcrypt throws on a non-string hash.
  @Prop()
  passwordHash?: string;

  @Prop({ required: true, trim: true })
  name: string;

  // The tenant this account belongs to — every org-scoped query filters on
  // this. Set once at registration (new org + owner) or admin-creation
  // (caller's own org) and never changed via the update path.
  @Prop({ required: true, index: true })
  organizationId: string;

  // Which store within the org this user is attached to — optional because
  // an org owner oversees every store, not just one. When set, scopes
  // store-specific views (Manager/Consultant dashboards, per-store cron
  // fan-out) to just this store.
  @Prop()
  storeId?: string;

  // Additive vocabulary: 'admin'/'agent_user'/'user' are the original
  // route-gating roles (see RolesGuard, @Roles() decorators throughout) and
  // keep working unchanged. 'owner'/'manager'/'consultant' are the new
  // business-hierarchy labels from the Enterprise AI OS spec, layered on top
  // rather than replacing the original three — the org's first user gets
  // ['owner', 'admin'] so every existing admin-gated route keeps working for
  // them without touching every @Roles('admin') call site.
  @Prop({ type: [String], default: ['user'] })
  roles: string[];

  // agent_id/slug (CHAT_AGENTS or AgentRole.slug); only meaningful when
  // roles includes 'agent_user' — see users.service.ts's createByAdmin.
  @Prop()
  assignedAgentId?: string;

  // Free-text label, same convention as AgentRole.department (Phase 6) —
  // matched against a custom AgentRole's assignedDepartments to decide chat
  // @mention visibility. Optional; unset means "no department filter can
  // ever match" for this user, not "sees everything" (that's governed by
  // role, see chat.service.ts's listAgents).
  @Prop()
  department?: string;

  @Prop({ default: true })
  active: boolean;

  @Prop({ type: Object, default: {} })
  preferences: Record<string, unknown>;

  // Informational only today — nothing currently gates login or feature
  // access on this being true. Set once the user completes the OTP flow
  // sent at registration (see AuthService.register/verifyEmail).
  @Prop({ default: false })
  emailVerified: boolean;

  // bcrypt hash of the current outstanding OTP, never the raw code —
  // same reasoning as passwordHash. Cleared (undefined) once consumed or
  // superseded by a newer code. verify* is for the register-time
  // email-verification flow; reset* is the separate forgot-password flow —
  // kept as distinct pairs so verifying your email can never be used to
  // reset your password or vice versa.
  @Prop()
  verifyOtpHash?: string;

  @Prop()
  verifyOtpExpiresAt?: Date;

  @Prop()
  resetOtpHash?: string;

  @Prop()
  resetOtpExpiresAt?: Date;

  // Stable per-provider subject id (Google `sub`, Microsoft Graph `id`,
  // GitHub numeric `id` as a string) — looked up first on OAuth login, ahead
  // of matching by email, since a provider account's email can change while
  // its id never does. A user can accumulate more than one linked provider
  // (e.g. registered with a password, later added "Sign in with Google").
  @Prop({ type: Object, default: {} })
  oauthProviders: { google?: string; microsoft?: string; github?: string };
}

export const UserSchema = SchemaFactory.createForClass(User);
