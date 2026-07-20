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

  @Prop({ type: [ChatMessage], default: [] })
  messages: ChatMessage[];
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
