import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TimelineEvent, TimelineEventSchema } from './schemas/timeline-event.schema';
import { TimelineController } from './timeline.controller';
import { TimelineService } from './timeline.service';

// Injected into store-settings/dashboard/gamification/chat modules as an
// event-writer dependency, so it must never import any of THOSE back.
@Module({
  imports: [MongooseModule.forFeature([{ name: TimelineEvent.name, schema: TimelineEventSchema }])],
  controllers: [TimelineController],
  providers: [TimelineService],
  exports: [TimelineService],
})
export class TimelineModule {}
