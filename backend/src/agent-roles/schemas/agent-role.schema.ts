import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AgentRoleDocument = AgentRole & Document<Types.ObjectId>;

@Schema({ _id: false })
export class AgentRoleKpi {
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) description: string;
}
const AgentRoleKpiSchema = SchemaFactory.createForClass(AgentRoleKpi);

// Dynamically-generated AI personas (Dynamic Role Generator). NestJS owns all
// writes to this collection; python-agent reads it directly (read-only) to
// resolve a persona's system prompt — see personas.py's resolve_system_prompt.
@Schema({ timestamps: true, collection: 'agent_roles' })
export class AgentRole {
  // The tenant this dynamically-generated persona belongs to — without this,
  // every org would see (and could @mention) every other org's custom AI
  // roles. python-agent's personas.py also needs this once it resolves a
  // persona for a specific org's conversation (see Phase 5 in the roadmap).
  @Prop({ required: true, index: true })
  organizationId: string;

  // Stable id used as agent_id everywhere else (chat's @mention, personas.py
  // lookup) — distinct from Mongo's own _id, which is only used for this
  // module's own CRUD routing (PATCH/DELETE /agent-roles/:id). Unique per
  // org, not globally — two tenants can each have their own "sales_lead".
  @Prop({ required: true, index: true })
  slug: string;

  @Prop({ required: true }) name: string;
  @Prop({ default: '' }) department: string;
  @Prop({ default: '' }) description: string;

  @Prop({ type: [String], default: [] }) responsibilities: string[];
  @Prop({ type: [String], default: [] }) dailyTasks: string[];
  @Prop({ type: [String], default: [] }) weeklyTasks: string[];
  @Prop({ type: [AgentRoleKpiSchema], default: [] }) kpis: AgentRoleKpi[];

  @Prop({ required: true }) systemPrompt: string;

  @Prop({ required: true }) sourceDocumentName: string;
  // Qdrant document_id for the embedded source doc — used to call
  // python-agent's /roles/publish-source (on activate) and
  // /roles/discard-source (on delete).
  @Prop({ required: true }) sourceDocumentId: string;

  @Prop({ enum: ['draft', 'active'], default: 'draft', index: true })
  status: 'draft' | 'active';

  // Chat @mention visibility (Phase 6, Agent Marketplace). Both empty (the
  // default) = visible org-wide, identical to pre-Phase-6 behavior for every
  // existing role — see chat.service.ts's listAgents for how these combine.
  @Prop({ type: [String], default: [] })
  assignedDepartments: string[];

  @Prop({ type: [String], default: [] })
  assignedUserIds: string[];

  // Which of python-agent's registered tools this persona may call — empty
  // means unrestricted (see app.tools.registry.get_tool_definitions and
  // anthropic_client.call's docstring: an empty/falsy list is treated
  // identically to unset, so this is backward compatible for every existing
  // role with no migration needed).
  @Prop({ type: [String], default: [] })
  allowedTools: string[];

  // Unset = today's existing message-length/round-based heuristic
  // (app.agent.router.choose_model), unchanged. See Phase 5 plan notes for
  // why this is a model TIER, not a raw provider choice — Groq cannot make
  // tool calls, so exposing raw provider selection here could silently break
  // a tool-using persona.
  @Prop({ enum: ['fast', 'standard'] })
  modelTier?: 'fast' | 'standard';

  @Prop({ default: '#6b7280' }) avatarColor: string;

  // Audit trail only — no RBAC gating exists in this app yet (see plan notes).
  @Prop({ required: true }) createdBy: string;
}

export const AgentRoleSchema = SchemaFactory.createForClass(AgentRole);
AgentRoleSchema.index({ organizationId: 1, slug: 1 }, { unique: true });
