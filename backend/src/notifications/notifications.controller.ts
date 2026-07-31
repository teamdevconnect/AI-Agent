import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationsService } from './notifications.service';

// Creation (POST /) is authenticated the same way every other route here
// is — no separate "service token" mechanism. python-agent mints a
// short-lived JWT for the target user (same pattern ChatService.
// generateSystemConversation already uses for the scheduled report job) and
// this controller can't tell that call apart from one a real user's own
// session made — by design, since a notification is always scoped to
// exactly the user named in the token's `sub`, never an arbitrary userId
// from the request body.
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.list(user.sub);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(user.sub, dto, user.organizationId);
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.notificationsService.markRead(user.sub, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllRead(user.sub);
  }
}
