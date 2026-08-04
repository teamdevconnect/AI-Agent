import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { CreateWorkflowDefinitionDto } from './dto/create-workflow-definition.dto';
import { UpdateWorkflowDefinitionDto } from './dto/update-workflow-definition.dto';
import { WorkflowDefinition, WorkflowDefinitionDocument } from './schemas/workflow-definition.schema';
import { WorkflowExecution, WorkflowExecutionDocument } from './schemas/workflow-execution.schema';
import { WorkflowQueueService } from './workflow-queue.service';

export interface AvailableWorkflow {
  name: string;
  description: string;
}

@Injectable()
export class WorkflowsService {
  private readonly pythonAgentUrl: string;

  constructor(
    @InjectModel(WorkflowDefinition.name) private definitionModel: Model<WorkflowDefinitionDocument>,
    @InjectModel(WorkflowExecution.name) private executionModel: Model<WorkflowExecutionDocument>,
    private queue: WorkflowQueueService,
    private http: HttpService,
    private config: ConfigService,
  ) {
    this.pythonAgentUrl = this.config.get<string>('pythonAgentUrl') ?? 'http://localhost:8000';
  }

  list(organizationId: string) {
    return this.definitionModel.find({ organizationId }).sort({ createdAt: -1 }).exec();
  }

  // Proxies python-agent's own registry (GET /workflows) rather than
  // hardcoding the 6 known names here — new workflows registered there
  // (app.workflows.definitions) show up in the admin UI's dropdown with no
  // NestJS change needed.
  async listAvailable(userJwt: string): Promise<AvailableWorkflow[]> {
    const { data } = await firstValueFrom(
      this.http.get<{ workflows: AvailableWorkflow[] }>(`${this.pythonAgentUrl}/workflows`, {
        headers: { Authorization: `Bearer ${userJwt}` },
      }),
    );
    return data.workflows;
  }

  private async validate(dto: CreateWorkflowDefinitionDto | UpdateWorkflowDefinitionDto, userJwt: string) {
    if (dto.workflowName) {
      const available = await this.listAvailable(userJwt);
      if (!available.some((w) => w.name === dto.workflowName)) {
        throw new BadRequestException(`Unknown workflow: ${dto.workflowName}`);
      }
    }
    const triggerType = dto.triggerType;
    if (triggerType === 'schedule' && !dto.schedule) {
      throw new BadRequestException('schedule is required for triggerType "schedule"');
    }
    if (triggerType === 'event' && !dto.eventType) {
      throw new BadRequestException('eventType is required for triggerType "event"');
    }
  }

  async create(dto: CreateWorkflowDefinitionDto, organizationId: string, createdBy: string, userJwt: string) {
    await this.validate(dto, userJwt);
    const created = await this.definitionModel.create({ ...dto, organizationId, createdBy });
    await this.queue.syncSchedule(created);
    return created;
  }

  async update(id: string, dto: UpdateWorkflowDefinitionDto, organizationId: string, userJwt: string) {
    const existing = await this.definitionModel.findOne({ _id: id, organizationId }).exec();
    if (!existing) throw new NotFoundException('Workflow not found');

    await this.validate({ ...existing.toObject(), ...dto }, userJwt);
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) (existing as unknown as Record<string, unknown>)[key] = value;
    }
    await existing.save();
    await this.queue.syncSchedule(existing);
    return existing;
  }

  async remove(id: string, organizationId: string) {
    const existing = await this.definitionModel.findOneAndDelete({ _id: id, organizationId }).exec();
    if (!existing) throw new NotFoundException('Workflow not found');
    await this.queue.removeSchedule(id);
  }

  async runNow(id: string, organizationId: string) {
    const existing = await this.definitionModel.findOne({ _id: id, organizationId }).exec();
    if (!existing) throw new NotFoundException('Workflow not found');
    await this.queue.enqueueManual(id);
    return { enqueued: true };
  }

  listExecutions(id: string, organizationId: string) {
    return this.executionModel
      .find({ workflowDefinitionId: id, organizationId })
      .sort({ startedAt: -1 })
      .limit(50)
      .exec();
  }
}
