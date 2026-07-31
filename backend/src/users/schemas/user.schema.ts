import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document<Types.ObjectId>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

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
}

export const UserSchema = SchemaFactory.createForClass(User);
