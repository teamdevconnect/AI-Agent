import { ChatService } from '../chat/chat.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
export declare function resolveAllowedAgentIds(chatService: ChatService, caller?: JwtPayload): Promise<string[]>;
