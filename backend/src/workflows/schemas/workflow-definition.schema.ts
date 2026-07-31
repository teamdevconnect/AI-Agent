import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WorkflowDefinitionDocument = WorkflowDefinition & Document<Types.ObjectId>;

// Configures WHEN one of python-agent's already-working workflows
// (app/workflows/definitions.py — morning_brief, eod_report, todo_agent,
// eod_agent, crm_follow_up_check, summarize_document) runs. This schema
// answers "when"; the workflow's actual behavior stays entirely in
// python-agent, unchanged.
@Schema({ timestamps: true, collection: 'workflow_definitions' })
export class WorkflowDefinition {
  @Prop({ required: true, index: true })
  organizationId: string;

  // Admin-facing label — distinct from workflowName below.
  @Prop({ required: true })
  name: string;

  // Must match one of python-agent's registered workflow names (GET
  // /workflows/available) — validated at create/update time, same pattern
  // as users.service.ts's assignedAgentId validation.
  @Prop({ required: true })
  workflowName: string;

  @Prop({ required: true, enum: ['schedule', 'event', 'manual'] })
  triggerType: 'schedule' | 'event' | 'manual';

  // Cron expression — only meaningful (and required) for triggerType:'schedule'.
  @Prop()
  schedule?: string;

  // One of TimelineEvent's known types — only meaningful (and required) for
  // triggerType:'event'. See timeline-event.schema.ts's TimelineEventType
  // comment for the known values; deliberately a plain string for the same
  // reason that field is, so new event types don't need a migration here either.
  @Prop()
  eventType?: string;

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ required: true })
  createdBy: string;
}

export const WorkflowDefinitionSchema = SchemaFactory.createForClass(WorkflowDefinition);
