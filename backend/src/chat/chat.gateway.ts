import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ChatService } from './chat.service';

interface AuthedSocket extends Socket {
  data: { user?: JwtPayload; token?: string };
}

@WebSocketGateway({ namespace: '/chat', cors: { origin: true, credentials: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
  ) {}

  handleConnection(client: AuthedSocket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.headers.authorization ?? '').replace(/^Bearer\s+/i, '');

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      client.data.user = payload;
      client.data.token = token;
      // Per-user room (Socket.IO auto-creates it on first join) — lets
      // emitToUser() below push to every tab/device a user has open,
      // without either side tracking socket ids itself.
      client.join(payload.sub);
    } catch {
      this.logger.warn(`Rejected unauthenticated socket ${client.id}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket) {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  /** Pushes an event to every socket a user currently has open (their
   * per-user room, joined in handleConnection). A no-op if they're not
   * connected right now — used by NotificationsService for live push;
   * REST (GET /notifications) is still the source of truth for anyone who
   * missed the live event. */
  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(userId).emit(event, payload);
  }

  @SubscribeMessage('message')
  async onMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { message: string; conversationId?: string; agentId?: string },
  ) {
    const user = client.data.user;
    const token = client.data.token;
    if (!user || !token) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    // agent_user accounts only ever see one agent in the mention list anyway
    // — default new conversations to it so they don't need to @mention.
    // roles?. guards a token with no roles claim at all (e.g. one minted
    // directly with a shared secret rather than through /auth/login) — this
    // threw uncaught and silently killed the whole handler before it ever
    // emitted 'typing', with no visible error anywhere.
    const agentId = body.agentId ?? (user.roles?.includes('agent_user') ? user.assignedAgentId : undefined);

    // Reassigned the instant the real id is known (see onConversationId
    // below) — a brand-new conversation has no id yet when this handler
    // starts, but every event emitted from here on (including a 'cancel'
    // the client might send mid-stream) needs the real one, not undefined.
    let conversationId = body.conversationId;

    client.emit('typing', { typing: true });
    // Wrapped end-to-end: an unhandled rejection anywhere in this call
    // (Mongoose validation, python-agent unreachable, anything) used to die
    // silently — the client would see 'typing: true' and then nothing ever
    // again, no error, no timeout, just permanent silence. Found via a real
    // cancellation test that happened to produce an empty final reply,
    // which failed the conversation schema's `content: { required: true }`
    // string validator (Mongoose treats '' as not satisfying `required` for
    // strings) inside ChatService.finishTurn — but the fix here is general:
    // no future bug of this shape should ever go this quiet again.
    try {
      const result = await this.chatService.sendMessageStreaming(
        user.sub,
        user.organizationId,
        token,
        body.message,
        body.conversationId,
        (event) => {
          if (event.type === 'delta') {
            client.emit('chunk', { conversationId, delta: event.text });
          } else if (event.type === 'progress') {
            client.emit('progress', { conversationId, tool: event.tool });
          } else if (event.type === 'reasoning') {
            client.emit('reasoning', { conversationId, text: event.text });
          } else if (event.type === 'plan') {
            client.emit('plan', { conversationId, agents: event.agents });
          } else if (event.type === 'agent_done') {
            client.emit('agentDone', { conversationId, agent: event.agent });
          } else if (event.type === 'reflecting') {
            client.emit('reflecting', { conversationId, reason: event.reason });
          }
        },
        agentId,
        (resolvedId) => {
          conversationId = resolvedId;
          client.emit('conversationId', { conversationId: resolvedId });
        },
      );
      client.emit('typing', { typing: false });
      client.emit('message', result);
    } catch (err) {
      this.logger.error(`onMessage failed for conversation ${conversationId}: ${(err as Error).message}`);
      client.emit('typing', { typing: false });
      client.emit('error', { message: "Something went wrong generating that reply. Please try again." });
    }
  }

  /** Best-effort "stop generating" — see ChatService.cancelAgent. Purely
   * advisory from the client's point of view: the UI already stops
   * rendering further chunks locally the instant this is sent (see
   * chatService.ts's StreamController.stop), this just also asks
   * python-agent to actually halt token generation server-side. */
  @SubscribeMessage('cancel')
  async onCancel(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { conversationId?: string }) {
    const token = client.data.token;
    if (!token || !body.conversationId) return;
    await this.chatService.cancelAgent(body.conversationId, token);
  }
}
