import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkflowDefinition, WorkflowDefinitionDocument } from './schemas/workflow-definition.schema';
import { WorkflowExecution, WorkflowExecutionDocument } from './schemas/workflow-execution.schema';

const QUEUE_NAME = 'workflows';

interface JobData {
  definitionId: string;
  triggeredBy: 'schedule' | 'event' | 'manual';
}

// Owns BullMQ's actual Queue/Worker — the only place in this app that talks
// to Redis for anything other than caching. Deliberately a SEPARATE ioredis
// connection from RedisCacheService's (see that file's comment, which
// already anticipated this): BullMQ's Worker/QueueEvents require
// `maxRetriesPerRequest: null`, and a queue's failure semantics must be
// louder than a cache's fail-open one — a down Redis here means workflows
// silently stop running, not just a slower page load.
@Injectable()
export class WorkflowQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(WorkflowQueueService.name);
  private readonly connection: IORedis;
  private readonly queue: Queue<JobData>;
  private readonly worker: Worker<JobData>;
  private readonly pythonAgentUrl: string;

  constructor(
    private config: ConfigService,
    private jwt: JwtService,
    private http: HttpService,
    @InjectModel(WorkflowDefinition.name) private definitionModel: Model<WorkflowDefinitionDocument>,
    @InjectModel(WorkflowExecution.name) private executionModel: Model<WorkflowExecutionDocument>,
    private notificationsService: NotificationsService,
  ) {
    this.pythonAgentUrl = this.config.get<string>('pythonAgentUrl') ?? 'http://localhost:8000';
    this.connection = new IORedis(this.config.get<string>('redisUrl')!, { maxRetriesPerRequest: null });
    this.connection.on('error', (err) =>
      this.logger.error(`Workflow queue Redis connection issue (scheduled/event-triggered workflows will not run until this recovers): ${err.message}`),
    );

    this.queue = new Queue<JobData>(QUEUE_NAME, { connection: this.connection });
    this.worker = new Worker<JobData>(QUEUE_NAME, (job) => this.process(job), { connection: this.connection });
    this.worker.on('failed', (job, err) =>
      this.logger.error(`Workflow job ${job?.id} (definition ${job?.data.definitionId}) failed: ${err.message}`),
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
    this.connection.disconnect();
  }

  enqueueManual(definitionId: string) {
    return this.queue.add('run', { definitionId, triggeredBy: 'manual' });
  }

  async enqueueForEvent(organizationId: string, eventType: string): Promise<void> {
    const definitions = await this.definitionModel
      .find({ organizationId, triggerType: 'event', eventType, enabled: true })
      .exec();
    await Promise.all(
      definitions.map((d) => this.queue.add('run', { definitionId: d._id.toString(), triggeredBy: 'event' })),
    );
  }

  // Idempotent — always clears any existing repeatable job for this
  // definition first, so calling this again after an edit (new cron
  // expression, disabled, or trigger type changed away from 'schedule')
  // never leaves a stale duplicate running.
  async syncSchedule(definition: WorkflowDefinitionDocument): Promise<void> {
    const definitionId = definition._id.toString();
    await this.removeSchedule(definitionId);
    if (definition.enabled && definition.triggerType === 'schedule' && definition.schedule) {
      await this.queue.add(
        'run',
        { definitionId, triggeredBy: 'schedule' },
        { repeat: { pattern: definition.schedule }, jobId: `schedule:${definitionId}` },
      );
    }
  }

  async removeSchedule(definitionId: string): Promise<void> {
    const repeatables = await this.queue.getRepeatableJobs();
    const match = repeatables.find((r) => r.id === `schedule:${definitionId}`);
    if (match) await this.queue.removeRepeatableByKey(match.key);
  }

  private async process(job: Job<JobData>): Promise<void> {
    const definition = await this.definitionModel.findById(job.data.definitionId).exec();
    if (!definition || !definition.enabled) return;

    const startedAt = new Date();
    // Short-lived service token, same bridge-token pattern already used by
    // dashboard.service.ts's internal calls and prospectconnect.py's native
    // CRM fallback — organizationId is what lets the workflow's own CRM/tool
    // calls resolve THIS org's credentials, not python-agent's global fallback.
    const token = this.jwt.sign({ sub: definition.createdBy, organizationId: definition.organizationId }, { expiresIn: '10m' });

    try {
      const { data } = await firstValueFrom(
        this.http.post(
          `${this.pythonAgentUrl}/workflows/${definition.workflowName}/run`,
          { context: { organization_id: definition.organizationId } },
          { headers: { Authorization: `Bearer ${token}` }, timeout: 120_000 },
        ),
      );
      await this.recordExecution(definition, job.data.triggeredBy, startedAt, 'success', JSON.stringify(data));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.recordExecution(definition, job.data.triggeredBy, startedAt, 'failed', undefined, message);
      await this.notificationsService.create(
        definition.createdBy,
        {
          title: `Workflow "${definition.name}" failed`,
          description: message,
          kind: 'error',
          source: `workflow:${definition.workflowName}`,
        },
        definition.organizationId,
      );
    }
  }

  private recordExecution(
    definition: WorkflowDefinitionDocument,
    triggeredBy: JobData['triggeredBy'],
    startedAt: Date,
    status: 'success' | 'failed',
    output?: string,
    error?: string,
  ) {
    const finishedAt = new Date();
    return this.executionModel.create({
      organizationId: definition.organizationId,
      workflowDefinitionId: definition._id.toString(),
      workflowName: definition.workflowName,
      triggeredBy,
      status,
      output,
      error,
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    });
  }
}
