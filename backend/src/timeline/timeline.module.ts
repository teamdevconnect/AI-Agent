import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkflowsModule } from '../workflows/workflows.module';
import { TimelineEvent, TimelineEventSchema } from './schemas/timeline-event.schema';
import { TimelineController } from './timeline.controller';
import { TimelineService } from './timeline.service';

// Injected into store-settings/dashboard/gamification/chat modules as an
// event-writer dependency, so it must never import any of THOSE back
// (that's the circularity that matters). WorkflowsModule is the one
// exception — it doesn't import TimelineModule itself, so this stays
// one-directional: added in Phase 7 so record() can enqueue 'event'-type
// WorkflowDefinitions, exactly what Phase 4's own TimelineEvent schema
// comment anticipated ("Phase 7's workflow-engine events... can be added
// without a schema migration").
@Module({
  imports: [MongooseModule.forFeature([{ name: TimelineEvent.name, schema: TimelineEventSchema }]), WorkflowsModule],
  controllers: [TimelineController],
  providers: [TimelineService],
  exports: [TimelineService],
})
export class TimelineModule {}
