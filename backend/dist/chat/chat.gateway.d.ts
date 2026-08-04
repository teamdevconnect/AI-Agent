import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ChatService } from './chat.service';
interface AuthedSocket extends Socket {
    data: {
        user?: JwtPayload;
        token?: string;
    };
}
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private chatService;
    private jwtService;
    private readonly logger;
    server: Server;
    constructor(chatService: ChatService, jwtService: JwtService);
    handleConnection(client: AuthedSocket): void;
    handleDisconnect(client: AuthedSocket): void;
    emitToUser(userId: string, event: string, payload: unknown): void;
    onMessage(client: AuthedSocket, body: {
        message: string;
        conversationId?: string;
        agentId?: string;
    }): Promise<void>;
    onCancel(client: AuthedSocket, body: {
        conversationId?: string;
    }): Promise<void>;
}
export {};
