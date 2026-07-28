import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

<<<<<<< HEAD
=======
  @Get('agents')
  listAgents(@CurrentUser() user: JwtPayload) {
    return this.chatService.listAgents(user);
  }

>>>>>>> 6a60a8648 (Initial AI Agent source code)
  @Get('conversations')
  listConversations(@CurrentUser() user: JwtPayload) {
    return this.chatService.listConversations(user.sub);
  }

  @Get('conversations/:id')
  getConversation(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.chatService.getConversation(user.sub, id);
  }

  @Post('messages')
  sendMessage(@CurrentUser() user: JwtPayload, @Req() req: Request, @Body() dto: SendMessageDto) {
    const bearerToken = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
<<<<<<< HEAD
    return this.chatService.sendMessage(user.sub, bearerToken, dto.message, dto.conversationId);
=======
    // agent_user accounts only ever see one agent in the mention list anyway
    // — default new conversations to it so they don't need to @mention.
    const agentId = dto.agentId ?? (user.roles.includes('agent_user') ? user.assignedAgentId : undefined);
    return this.chatService.sendMessage(user.sub, bearerToken, dto.message, dto.conversationId, agentId);
>>>>>>> 6a60a8648 (Initial AI Agent source code)
  }
}
