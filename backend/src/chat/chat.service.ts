import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { firstValueFrom } from 'rxjs';
import { Model } from 'mongoose';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';

interface AgentReply {
  reply: string;
  tools_used?: string[];
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly agentUrl: string;

  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    private http: HttpService,
    private config: ConfigService,
  ) {
    this.agentUrl = this.config.get<string>('pythonAgentUrl') ?? 'http://localhost:8000';
  }

  listConversations(userId: string) {
    return this.conversationModel
      .find({ userId })
      .select({ title: 1, updatedAt: 1, createdAt: 1 })
      .sort({ updatedAt: -1 })
      .exec();
  }

  getConversation(userId: string, conversationId: string) {
    return this.conversationModel.findOne({ _id: conversationId, userId }).exec();
  }

  async sendMessage(
    userId: string,
    userJwt: string,
    message: string,
    conversationId?: string,
  ) {
    let conversation = conversationId
      ? await this.conversationModel.findOne({ _id: conversationId, userId })
      : null;

    if (!conversation) {
      conversation = await this.conversationModel.create({
        userId,
        title: message.slice(0, 60),
        messages: [],
      });
    }

    conversation.messages.push({
      role: 'user',
      content: message,
      toolsUsed: [],
      createdAt: new Date(),
    });

    const agentReply = await this.callAgent(userId, userJwt, conversation._id.toString(), message);

    conversation.messages.push({
      role: 'assistant',
      content: agentReply.reply,
      toolsUsed: agentReply.tools_used ?? [],
      createdAt: new Date(),
    });
    await conversation.save();

    return {
      conversationId: conversation._id.toString(),
      reply: agentReply.reply,
      toolsUsed: agentReply.tools_used ?? [],
    };
  }

  private async callAgent(
    userId: string,
    userJwt: string,
    conversationId: string,
    message: string,
  ): Promise<AgentReply> {
    try {
      const response = await firstValueFrom(
        this.http.post<AgentReply>(
          `${this.agentUrl}/chat`,
          { user_id: userId, conversation_id: conversationId, message },
          { headers: { Authorization: `Bearer ${userJwt}` } },
        ),
      );
      return response.data;
    } catch (err) {
      this.logger.error(`python-agent call failed: ${(err as Error).message}`);
      return {
        reply:
          "I couldn't reach the AI agent service. Please try again shortly.",
        tools_used: [],
      };
    }
  }
}
