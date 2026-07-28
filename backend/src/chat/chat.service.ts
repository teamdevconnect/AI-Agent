import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
<<<<<<< HEAD
import { InjectModel } from '@nestjs/mongoose';
import { firstValueFrom } from 'rxjs';
import { Model } from 'mongoose';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
=======
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { firstValueFrom } from 'rxjs';
import { Model } from 'mongoose';
import { RedisCacheService } from '../common/redis/redis-cache.service';
import { AgentRole, AgentRoleDocument } from '../agent-roles/schemas/agent-role.schema';
import { CHAT_AGENTS } from './agents';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { JwtPayload } from '../auth/jwt-payload.interface';
>>>>>>> 6a60a8648 (Initial AI Agent source code)

interface AgentReply {
  reply: string;
  tools_used?: string[];
}

<<<<<<< HEAD
=======
export interface StreamEvent {
  type: 'delta' | 'progress' | 'reasoning' | 'plan' | 'agent_done' | 'reflecting';
  text?: string;
  tool?: string;
  agents?: string[];
  agent?: string;
  reason?: string;
}

const CACHE_TTL_SECONDS = 45;

>>>>>>> 6a60a8648 (Initial AI Agent source code)
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly agentUrl: string;

  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
<<<<<<< HEAD
    private http: HttpService,
    private config: ConfigService,
=======
    @InjectModel(AgentRole.name) private agentRoleModel: Model<AgentRoleDocument>,
    private http: HttpService,
    private config: ConfigService,
    private cache: RedisCacheService,
    private jwt: JwtService,
>>>>>>> 6a60a8648 (Initial AI Agent source code)
  ) {
    this.agentUrl = this.config.get<string>('pythonAgentUrl') ?? 'http://localhost:8000';
  }

<<<<<<< HEAD
  listConversations(userId: string) {
    return this.conversationModel
=======
  /** Static personas + any activated Dynamic Role Generator roles — the
   * source list for chat's @mention widget. Dynamic roles only surface once
   * 'active' (see agent-roles module's draft/active review workflow).
   * When called on behalf of an agent_user (not also admin), scoped down to
   * just their one assigned agent — RBAC boundary, not just a UI filter,
   * since DashboardService.getOverview() also reuses this for its own scoping. */
  async listAgents(caller?: JwtPayload) {
    const dynamic = await this.agentRoleModel
      .find({ status: 'active' })
      .select({ slug: 1, name: 1, description: 1, avatarColor: 1 })
      .exec();
    const all = [
      ...CHAT_AGENTS,
      ...dynamic.map((d) => ({ id: d.slug, name: d.name, description: d.description, avatarColor: d.avatarColor })),
    ];

    if (caller?.roles?.includes('agent_user') && !caller.roles.includes('admin')) {
      return all.filter((a) => a.id === caller.assignedAgentId);
    }
    return all;
  }

  async listConversations(userId: string) {
    const cacheKey = `chat:conversations:${userId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.conversationModel
>>>>>>> 6a60a8648 (Initial AI Agent source code)
      .find({ userId })
      .select({ title: 1, updatedAt: 1, createdAt: 1 })
      .sort({ updatedAt: -1 })
      .exec();
<<<<<<< HEAD
  }

  getConversation(userId: string, conversationId: string) {
    return this.conversationModel.findOne({ _id: conversationId, userId }).exec();
=======
    await this.cache.set(cacheKey, result, CACHE_TTL_SECONDS);
    return result;
  }

  async getConversation(userId: string, conversationId: string) {
    // Cache key deliberately includes userId, not just conversationId — the
    // underlying query enforces ownership via {_id, userId}; keying the
    // cache on conversationId alone would let a cache hit bypass that check
    // for any authenticated user who knew/guessed another user's id.
    const cacheKey = `chat:conversation:${userId}:${conversationId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.conversationModel.findOne({ _id: conversationId, userId }).exec();
    if (result) await this.cache.set(cacheKey, result, CACHE_TTL_SECONDS);
    return result;
>>>>>>> 6a60a8648 (Initial AI Agent source code)
  }

  async sendMessage(
    userId: string,
    userJwt: string,
    message: string,
    conversationId?: string,
<<<<<<< HEAD
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
=======
    agentId?: string,
  ) {
    const conversation = await this.getOrCreateConversation(userId, message, conversationId, agentId);
    const resolvedAgentId = this.resolveConversationAgent(conversation, agentId);
>>>>>>> 6a60a8648 (Initial AI Agent source code)

    conversation.messages.push({
      role: 'user',
      content: message,
      toolsUsed: [],
      createdAt: new Date(),
    });

<<<<<<< HEAD
    const agentReply = await this.callAgent(userId, userJwt, conversation._id.toString(), message);

    conversation.messages.push({
      role: 'assistant',
      content: agentReply.reply,
=======
    const agentReply = await this.callAgent(userId, userJwt, conversation._id.toString(), message, resolvedAgentId);

    return this.finishTurn(conversation, agentReply);
  }

  /** Same as sendMessage, but relays live text/tool-progress events via
   * onEvent as they arrive from python-agent's SSE endpoint, instead of
   * blocking until the whole reply is ready. Used by the WebSocket gateway,
   * which has a socket to push events to — the REST controller has none,
   * so it keeps using the non-streaming sendMessage() above unchanged. */
  async sendMessageStreaming(
    userId: string,
    userJwt: string,
    message: string,
    conversationId: string | undefined,
    onEvent: (event: StreamEvent) => void,
    agentId?: string,
    // Fired the instant the real conversation id is known — for a brand-new
    // conversation that's only now, mid-call, not at the start (there's no
    // id to hand the caller until getOrCreateConversation resolves). The
    // gateway uses this to tell the client the real id early enough that a
    // "stop generating" click during a first message can actually name the
    // right conversation to cancel — without this, the client only learns
    // the real id from the terminal result, by which point it's too late.
    onConversationId?: (id: string) => void,
  ) {
    const conversation = await this.getOrCreateConversation(userId, message, conversationId, agentId);
    onConversationId?.(conversation._id.toString());
    const resolvedAgentId = this.resolveConversationAgent(conversation, agentId);

    conversation.messages.push({
      role: 'user',
      content: message,
      toolsUsed: [],
      createdAt: new Date(),
    });

    const agentReply = await this.callAgentStreaming(
      userId,
      userJwt,
      conversation._id.toString(),
      message,
      onEvent,
      resolvedAgentId,
    );

    return this.finishTurn(conversation, agentReply);
  }

  /** Creates a conversation with no live user turn driving it — used by the
   * scheduled morning to-do / EOD report job. Always creates fresh (no
   * existing-conversation lookup), always non-streaming (no socket to push
   * to for a background job). Reuses finishTurn() so the Redis cache
   * invalidation added for live chat covers this write path too. */
  async generateSystemConversation(userId: string, agentId: string, promptText: string, title: string) {
    const conversation = await this.conversationModel.create({ userId, title, agentId, messages: [] });
    conversation.messages.push({
      role: 'user',
      content: promptText,
      toolsUsed: [],
      createdAt: new Date(),
    });

    const userJwt = this.jwt.sign({ sub: userId }, { expiresIn: '5m' });
    const agentReply = await this.callAgent(userId, userJwt, conversation._id.toString(), promptText, agentId);

    return this.finishTurn(conversation, agentReply);
  }

  private async getOrCreateConversation(
    userId: string,
    message: string,
    conversationId?: string,
    agentId?: string,
  ) {
    const existing = conversationId
      ? await this.conversationModel.findOne({ _id: conversationId, userId })
      : null;
    if (existing) return existing;

    return this.conversationModel.create({
      userId,
      title: message.slice(0, 60),
      agentId,
      messages: [],
    });
  }

  /** A conversation's persona is set once and stays sticky — the first
   * explicit @mention (or none, for the generic assistant) wins for the
   * conversation's lifetime. Ignores requestedAgentId once a conversation
   * already has one (server-side sticky, not trusted per-message from the
   * client) and persists a first-time selection onto the in-memory document
   * (saved along with the rest of the turn in finishTurn()). */
  private resolveConversationAgent(conversation: ConversationDocument, requestedAgentId?: string): string | undefined {
    if (!conversation.agentId && requestedAgentId) {
      conversation.agentId = requestedAgentId;
    }
    return conversation.agentId;
  }

  private async finishTurn(conversation: ConversationDocument, agentReply: AgentReply) {
    conversation.messages.push({
      role: 'assistant',
      // Mongoose's `content: { required: true }` (see schemas/conversation.schema.ts)
      // rejects '' for a String path — not just missing/null — so an
      // empty reply (a turn cancelled before any text streamed, see
      // ChatGateway's 'cancel' handler) would otherwise throw a
      // ValidationError here. Caught via a live cancellation test that hit
      // exactly this.
      content: agentReply.reply || '[No response — cancelled before any text was generated]',
>>>>>>> 6a60a8648 (Initial AI Agent source code)
      toolsUsed: agentReply.tools_used ?? [],
      createdAt: new Date(),
    });
    await conversation.save();

<<<<<<< HEAD
    return {
      conversationId: conversation._id.toString(),
=======
    const userId = conversation.userId;
    const conversationId = conversation._id.toString();
    await this.cache.del(`chat:conversations:${userId}`, `chat:conversation:${userId}:${conversationId}`);

    return {
      conversationId,
>>>>>>> 6a60a8648 (Initial AI Agent source code)
      reply: agentReply.reply,
      toolsUsed: agentReply.tools_used ?? [],
    };
  }

  private async callAgent(
    userId: string,
    userJwt: string,
    conversationId: string,
    message: string,
<<<<<<< HEAD
=======
    agentId?: string,
>>>>>>> 6a60a8648 (Initial AI Agent source code)
  ): Promise<AgentReply> {
    try {
      const response = await firstValueFrom(
        this.http.post<AgentReply>(
          `${this.agentUrl}/chat`,
<<<<<<< HEAD
          { user_id: userId, conversation_id: conversationId, message },
=======
          { user_id: userId, conversation_id: conversationId, message, agent_id: agentId },
>>>>>>> 6a60a8648 (Initial AI Agent source code)
          { headers: { Authorization: `Bearer ${userJwt}` } },
        ),
      );
      return response.data;
    } catch (err) {
      this.logger.error(`python-agent call failed: ${(err as Error).message}`);
      return {
<<<<<<< HEAD
        reply:
          "I couldn't reach the AI agent service. Please try again shortly.",
=======
        reply: "I couldn't reach the AI agent service. Please try again shortly.",
>>>>>>> 6a60a8648 (Initial AI Agent source code)
        tools_used: [],
      };
    }
  }
<<<<<<< HEAD
=======

  /** Calls python-agent's /chat/stream (Server-Sent Events) and relays each
   * delta/progress frame to onEvent as it arrives, resolving with the
   * terminal "done" frame's reply/tools_used — same external contract as
   * callAgent(), just fed incrementally instead of all at once. */
  private async callAgentStreaming(
    userId: string,
    userJwt: string,
    conversationId: string,
    message: string,
    onEvent: (event: StreamEvent) => void,
    agentId?: string,
  ): Promise<AgentReply> {
    try {
      const response = await firstValueFrom(
        this.http.post(
          `${this.agentUrl}/chat/stream`,
          { user_id: userId, conversation_id: conversationId, message, agent_id: agentId },
          { headers: { Authorization: `Bearer ${userJwt}` }, responseType: 'stream' },
        ),
      );

      return await new Promise<AgentReply>((resolve, reject) => {
        let buffer = '';
        let settled = false;
        const stream = response.data as NodeJS.ReadableStream;

        stream.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf8');
          let boundary: number;
          while ((boundary = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            if (!frame.startsWith('data: ')) continue;

            const event = JSON.parse(frame.slice(6));
            if (
              event.type === 'delta' ||
              event.type === 'progress' ||
              event.type === 'reasoning' ||
              event.type === 'plan' ||
              event.type === 'agent_done' ||
              event.type === 'reflecting'
            ) {
              onEvent(event);
            } else if (event.type === 'done') {
              settled = true;
              resolve({ reply: event.reply, tools_used: event.tools_used });
            } else if (event.type === 'error') {
              settled = true;
              reject(new Error(event.message));
            }
          }
        });
        stream.on('end', () => {
          if (!settled) reject(new Error('Agent stream ended without a final result'));
        });
        stream.on('error', (err) => {
          if (!settled) reject(err);
        });
      });
    } catch (err) {
      this.logger.error(`python-agent streaming call failed: ${(err as Error).message}`);
      return {
        reply: "I couldn't reach the AI agent service. Please try again shortly.",
        tools_used: [],
      };
    }
  }

  /** Relays a "stop generating" request to python-agent's cancellation
   * registry (app.agent.cancellation) for this conversation's in-flight
   * stream, if any. Best-effort: logs and swallows failures rather than
   * throwing — a failed cancel must never crash the socket handler that
   * called it (ChatGateway's 'cancel' handler), since the user already
   * sees generation stop client-side regardless. */
  async cancelAgent(conversationId: string, userJwt: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${this.agentUrl}/chat/stream/cancel`,
          { conversation_id: conversationId },
          { headers: { Authorization: `Bearer ${userJwt}` } },
        ),
      );
    } catch (err) {
      this.logger.warn(`Cancel request to python-agent failed: ${(err as Error).message}`);
    }
  }
>>>>>>> 6a60a8648 (Initial AI Agent source code)
}
