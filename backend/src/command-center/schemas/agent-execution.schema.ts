import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AgentExecutionDocument = AgentExecution & Document<Types.ObjectId>;

// Read-only from the NestJS side — python-agent is the sole writer (see
// python-agent/app/observability/execution_store.py), persisting what
// app/observability/tracing.py's traced_llm_call/traced_tool_call already
// compute. Field names are camelCase to match python-agent's writes, which
// deliberately mirror this database's existing convention (Conversation,
// DailyReport, TimelineEvent, ...) rather than Python's native snake_case.
// Nothing here is `required` at the Mongoose level — this schema exists for
// typed queries, not to validate documents this app never creates.
@Schema({ collection: 'agent_executions' })
export class AgentExecution {
  @Prop({ index: true })
  organizationId?: string;

  @Prop({ index: true })
  userId?: string;

  @Prop({ index: true })
  conversationId?: string;

  @Prop({ enum: ['llm', 'tool'], index: true })
  kind: 'llm' | 'tool';

  @Prop()
  name: string;

  @Prop({ index: true })
  provider?: 'anthropic' | 'groq';

  @Prop()
  model?: string;

  @Prop()
  inputTokens?: number;

  @Prop()
  outputTokens?: number;

  @Prop({ type: Number })
  costUsd?: number | null;

  @Prop()
  latencyMs: number;

  @Prop()
  success: boolean;

  @Prop()
  error?: string;

  @Prop({ index: true })
  occurredAt: Date;
}

export const AgentExecutionSchema = SchemaFactory.createForClass(AgentExecution);
