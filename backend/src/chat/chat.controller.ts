import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

// Tighter than the app-wide default (see ThrottlerModule.forRoot in
// app.module.ts) — every message here is a real, billed LLM call
// (chat.service.ts -> python-agent), so this route's ceiling is its own
// direct spend control, not just abuse prevention.
const CHAT_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('agents')
  listAgents(@CurrentUser() user: JwtPayload) {
    return this.chatService.listAgents(user);
  }

  @Get('conversations')
  listConversations(@CurrentUser() user: JwtPayload) {
    return this.chatService.listConversations(user.sub);
  }

  @Get('conversations/:id')
  getConversation(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.chatService.getConversation(user.sub, id);
  }

  @Post('messages')
  @Throttle(CHAT_THROTTLE)
  sendMessage(@CurrentUser() user: JwtPayload, @Req() req: Request, @Body() dto: SendMessageDto) {
    const bearerToken = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    // agent_user accounts only ever see one agent in the mention list anyway
    // — default new conversations to it so they don't need to @mention.
    const agentId = dto.agentId ?? (user.roles.includes('agent_user') ? user.assignedAgentId : undefined);
    return this.chatService.sendMessage(user.sub, user.organizationId, bearerToken, dto.message, dto.conversationId, agentId);
  }
}
