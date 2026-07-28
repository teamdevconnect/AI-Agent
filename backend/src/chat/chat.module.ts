import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
<<<<<<< HEAD
import { AuthModule } from '../auth/auth.module';
=======
import { RedisCacheService } from '../common/redis/redis-cache.service';
import { AuthModule } from '../auth/auth.module';
import { AgentRole, AgentRoleSchema } from '../agent-roles/schemas/agent-role.schema';
>>>>>>> 6a60a8648 (Initial AI Agent source code)
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

@Module({
  imports: [
<<<<<<< HEAD
    MongooseModule.forFeature([{ name: Conversation.name, schema: ConversationSchema }]),
=======
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      // Independent local registration (not imported from AgentRolesModule) —
      // Mongoose's core connection module is global, so any module can bind
      // its own model to the same 'agent_roles' collection. Used to merge
      // activated dynamic roles into listAgents() for the @mention widget.
      { name: AgentRole.name, schema: AgentRoleSchema },
    ]),
>>>>>>> 6a60a8648 (Initial AI Agent source code)
    // Agentic tool-calling turns (CRM/Outlook lookups across several rounds)
    // can legitimately take well over 30s — see chat.service.ts's callAgent.
    HttpModule.register({ timeout: 120_000 }),
    AuthModule,
  ],
  controllers: [ChatController],
<<<<<<< HEAD
  providers: [ChatService, ChatGateway],
=======
  providers: [ChatService, ChatGateway, RedisCacheService],
  // StoreSettingsModule calls ChatService.generateSystemConversation() for
  // the scheduled morning to-do / EOD report job. ChatGateway is exported so
  // NotificationsModule can push live socket events through the same
  // per-user-room connections chat already uses (see ChatGateway.emitToUser).
  exports: [ChatService, ChatGateway],
>>>>>>> 6a60a8648 (Initial AI Agent source code)
})
export class ChatModule {}
