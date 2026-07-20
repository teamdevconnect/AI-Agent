import { io, type Socket } from 'socket.io-client';
import { env } from '@/config/env';

let socket: Socket | null = null;

/**
 * Lazily creates the Socket.io connection. Phase 1 chat runs on the mock
 * streaming service (src/services/mock/chatService.ts) and never calls this,
 * but the client is wired and ready for Phase 2 to swap in against the real
 * NestJS `/chat` gateway (same event contract as the previous integration:
 * connect/disconnect/typing/message/error).
 */
export function getSocket(token: string): Socket {
  if (socket) return socket;
  socket = io(`${env.socketUrl}/chat`, { auth: { token }, autoConnect: false });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
