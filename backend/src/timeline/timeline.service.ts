import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkflowQueueService } from '../workflows/workflow-queue.service';
import { TimelineEvent, TimelineEventDocument, TimelineEventType } from './schemas/timeline-event.schema';

export interface RecordTimelineEventInput {
  organizationId: string;
  storeId?: string;
  userId?: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  sourceType: string;
  sourceId?: string;
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ListTimelineFilters {
  storeId?: string;
  userId?: string;
  type?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

// Single write path for the Timeline — every event writer across the app
// (store-settings, tasks, gamification, chat) funnels through this one
// method rather than writing to the collection directly, so there's exactly
// one place that decides field defaults/shape.
@Injectable()
export class TimelineService {
  private readonly logger = new Logger(TimelineService.name);

  constructor(
    @InjectModel(TimelineEvent.name) private eventModel: Model<TimelineEventDocument>,
    private workflowQueue: WorkflowQueueService,
  ) {}

  async record(input: RecordTimelineEventInput) {
    const event = await this.eventModel.create({ ...input, occurredAt: input.occurredAt ?? new Date() });
    // Fire-and-forget-ish, but caught: an enqueue failure (e.g. Redis down)
    // must never break the actual Timeline write, which is the primary
    // concern here — same fail-open spirit as RedisCacheService's caching,
    // just logged louder since a missed workflow trigger is more consequential.
    this.workflowQueue.enqueueForEvent(input.organizationId, input.type).catch((err: Error) => {
      this.logger.error(`Failed to enqueue event-triggered workflows for '${input.type}': ${err.message}`);
    });
    return event;
  }

  list(organizationId: string, filters: ListTimelineFilters = {}) {
    const query: Record<string, unknown> = { organizationId };
    if (filters.storeId) query.storeId = filters.storeId;
    if (filters.userId) query.userId = filters.userId;
    if (filters.type) query.type = filters.type;
    if (filters.from || filters.to) {
      query.occurredAt = {
        ...(filters.from ? { $gte: filters.from } : {}),
        ...(filters.to ? { $lte: filters.to } : {}),
      };
    }
    return this.eventModel
      .find(query)
      .sort({ occurredAt: -1 })
      .limit(filters.limit ?? 100)
      .exec();
  }
}
