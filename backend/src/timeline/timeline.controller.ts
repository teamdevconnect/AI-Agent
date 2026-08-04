import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ListTimelineQueryDto } from './dto/list-timeline-query.dto';
import { TimelineService } from './timeline.service';

@UseGuards(JwtAuthGuard)
@Controller('timeline')
export class TimelineController {
  constructor(private timelineService: TimelineService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListTimelineQueryDto) {
    return this.timelineService.list(user.organizationId, {
      storeId: query.storeId,
      userId: query.userId,
      type: query.type,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      limit: query.limit,
    });
  }
}
