import { ChatService } from '../chat/chat.service';
import { JwtPayload } from '../auth/jwt-payload.interface';

/** Single source of truth for "which agent ids can this caller see" — reused
 * by DashboardService and TasksService so there's exactly one place that
 * implements the agent_user scoping rule, not two that could drift apart. */
export async function resolveAllowedAgentIds(chatService: ChatService, caller?: JwtPayload): Promise<string[]> {
  const agents = await chatService.listAgents(caller);
  return agents.map((a) => a.id);
}
