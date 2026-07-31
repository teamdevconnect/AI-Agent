import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkflowDefinition, WorkflowDefinitionSchema } from './schemas/workflow-definition.schema';
import { WorkflowExecution, WorkflowExecutionSchema } from './schemas/workflow-execution.schema';
import { WorkflowQueueService } from './workflow-queue.service';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkflowDefinition.name, schema: WorkflowDefinitionSchema },
      { name: WorkflowExecution.name, schema: WorkflowExecutionSchema },
    ]),
    // A workflow run drives the full Planner/specialist/reflection stack —
    // same generous timeout as dashboard.module.ts's own relay to python-agent.
    HttpModule.register({ timeout: 120_000 }),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [WorkflowsController],
  providers: [WorkflowQueueService, WorkflowsService],
  // WorkflowQueueService.enqueueForEvent is TimelineService's hook point for
  // 'event'-triggered workflows — see timeline.module.ts's updated comment.
  exports: [WorkflowQueueService],
})
export class WorkflowsModule {}
