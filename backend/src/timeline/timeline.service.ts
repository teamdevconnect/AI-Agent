import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
  constructor(@InjectModel(TimelineEvent.name) private eventModel: Model<TimelineEventDocument>) {}

  async record(input: RecordTimelineEventInput) {
    return this.eventModel.create({ ...input, occurredAt: input.occurredAt ?? new Date() });
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
