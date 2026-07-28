import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationDocument = Conversation & Document<Types.ObjectId>;

@Schema({ _id: false })
export class ChatMessage {
  @Prop({ required: true, enum: ['user', 'assistant'] })
  role: 'user' | 'assistant';

  @Prop({ required: true })
  content: string;

  @Prop({ type: [String], default: [] })
  toolsUsed: string[];

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ default: 'New conversation' })
  title: string;

<<<<<<< HEAD
=======
  // Which persona (see backend/src/chat/agents.ts) this conversation talks
  // to — set once (first @mention, or a scheduled report's author) and
  // sticky for the conversation's lifetime. Undefined = generic assistant,
  // today's default behavior.
  @Prop()
  agentId?: string;

>>>>>>> 6a60a8648 (Initial AI Agent source code)
  @Prop({ type: [ChatMessage], default: [] })
  messages: ChatMessage[];
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
