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
  // Stable id used as agent_id everywhere else (chat's @mention, personas.py
  // lookup) — distinct from Mongo's own _id, which is only used for this
  // module's own CRUD routing (PATCH/DELETE /agent-roles/:id).
  @Prop({ required: true, unique: true, index: true })
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

  @Prop({ default: '#6b7280' }) avatarColor: string;

  // Audit trail only — no RBAC gating exists in this app yet (see plan notes).
  @Prop({ required: true }) createdBy: string;
}

export const AgentRoleSchema = SchemaFactory.createForClass(AgentRole);
