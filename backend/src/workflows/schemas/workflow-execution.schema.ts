import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WorkflowExecutionDocument = WorkflowExecution & Document<Types.ObjectId>;

// A history collection the admin UI reads — same spirit as Phase 5's
// agent_executions (Command Center), not a queryable business object.
// NestJS is the sole writer, one row per BullMQ job processed.
@Schema({ timestamps: true, collection: 'workflow_executions' })
export class WorkflowExecution {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, index: true })
  workflowDefinitionId: string;

  @Prop({ required: true })
  workflowName: string;

  @Prop({ required: true, enum: ['schedule', 'event', 'manual'] })
  triggeredBy: 'schedule' | 'event' | 'manual';

  @Prop({ required: true, enum: ['success', 'failed'] })
  status: 'success' | 'failed';

  @Prop()
  output?: string;

  @Prop()
  error?: string;

  @Prop({ required: true })
  startedAt: Date;

  @Prop({ required: true })
  finishedAt: Date;

  @Prop({ required: true })
  durationMs: number;
}

export const WorkflowExecutionSchema = SchemaFactory.createForClass(WorkflowExecution);
