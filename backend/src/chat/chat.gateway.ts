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
    } catch {
      this.logger.warn(`Rejected unauthenticated socket ${client.id}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket) {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('message')
  async onMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { message: string; conversationId?: string },
  ) {
    const user = client.data.user;
    const token = client.data.token;
    if (!user || !token) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    client.emit('typing', { typing: true });
    const result = await this.chatService.sendMessage(
      user.sub,
      token,
      body.message,
      body.conversationId,
    );
    client.emit('typing', { typing: false });
    client.emit('message', result);
  }
}
