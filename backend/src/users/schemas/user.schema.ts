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

  @Prop({ type: [String], default: ['user'] })
  roles: string[];

<<<<<<< HEAD
=======
  // agent_id/slug (CHAT_AGENTS or AgentRole.slug); only meaningful when
  // roles includes 'agent_user' — see users.service.ts's createByAdmin.
  @Prop()
  assignedAgentId?: string;

  @Prop({ default: true })
  active: boolean;

>>>>>>> 6a60a8648 (Initial AI Agent source code)
  @Prop({ type: Object, default: {} })
  preferences: Record<string, unknown>;
}

export const UserSchema = SchemaFactory.createForClass(User);
