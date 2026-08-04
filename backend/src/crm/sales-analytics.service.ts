import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Deal, DealDocument } from './schemas/deal.schema';
import { SalesTarget, SalesTargetDocument } from './schemas/sales-target.schema';
import { UpsertSalesTargetDto } from './dto/upsert-sales-target.dto';

export interface Achievement {
  period: string;
  targetAmount: number | null;
  currency: string;
  achieved: number;
  achievementPct: number | null;
  remaining: number | null;
  avgDailySalesNeeded: number | null;
  predictedMonthEnd: number;
  forecastConfidence: number;
}

function daysInMonth(period: string): number {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

/** Days of `period` that have elapsed as of now — daysInMonth for a past
 * period, 0 for a future one, today's day-of-month for the current one. */
function daysElapsed(period: string): number {
  const [year, month] = period.split('-').map(Number);
  const now = new Date();
  const total = daysInMonth(period);
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return total;
  if (year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1)) return 0;
  return now.getDate();
}

@Injectable()
export class SalesAnalyticsService {
  constructor(
    @InjectModel(Deal.name) private dealModel: Model<DealDocument>,
    @InjectModel(SalesTarget.name) private targetModel: Model<SalesTargetDocument>,
  ) {}

  async upsertTarget(organizationId: string, dto: UpsertSalesTargetDto) {
    if (dto.scope === 'store' && !dto.storeId) throw new BadRequestException('storeId is required for scope "store"');
    if (dto.scope === 'user' && !dto.userId) throw new BadRequestException('userId is required for scope "user"');

    const filter = {
      organizationId,
      scope: dto.scope,
      storeId: dto.scope === 'store' ? dto.storeId : undefined,
      userId: dto.scope === 'user' ? dto.userId : undefined,
      period: dto.period,
    };
    return this.targetModel
      .findOneAndUpdate(
        filter,
        { ...filter, targetAmount: dto.targetAmount, currency: dto.currency ?? 'INR' },
        { upsert: true, new: true },
      )
      .exec();
  }

  listTargets(organizationId: string, period?: string) {
    return this.targetModel.find({ organizationId, ...(period ? { period } : {}) }).exec();
  }

  /** Achievement %, remaining target, average daily sales still needed, and a
   * simple linear month-end projection — deliberately not a real forecasting
   * model (see plan notes): `achieved / daysElapsed * daysInMonth`, with a
   * coarse days-elapsed-ratio confidence score. Won deals are attributed to
   * the period via `expectedClosingDate`'s "YYYY-MM" prefix, a pragmatic
   * proxy in the absence of a separate "closed at" timestamp. */
  async getAchievement(
    organizationId: string,
    scope: 'org' | 'store' | 'user',
    scopeId: string | undefined,
    period: string,
  ): Promise<Achievement> {
    const dealFilter: Record<string, unknown> = {
      organizationId,
      dealStatus: 'won',
      expectedClosingDate: { $regex: `^${period}` },
    };
    if (scope === 'store') dealFilter.storeId = scopeId;
    if (scope === 'user') dealFilter.ownerId = scopeId;

    const [{ achieved = 0 } = {}, target] = await Promise.all([
      this.dealModel
        .aggregate<{ achieved: number }>([
          { $match: dealFilter },
          { $group: { _id: null, achieved: { $sum: '$monetaryValue' } } },
        ])
        .exec()
        .then((rows) => rows[0]),
      this.targetModel
        .findOne({
          organizationId,
          scope,
          storeId: scope === 'store' ? scopeId : undefined,
          userId: scope === 'user' ? scopeId : undefined,
          period,
        })
        .exec(),
    ]);

    const targetAmount = target?.targetAmount ?? null;
    const totalDays = daysInMonth(period);
    const elapsed = daysElapsed(period);
    const remainingDays = Math.max(totalDays - elapsed, 0);

    const remaining = targetAmount !== null ? Math.max(targetAmount - achieved, 0) : null;
    return {
      period,
      targetAmount,
      currency: target?.currency ?? 'INR',
      achieved,
      achievementPct: targetAmount ? Math.round((achieved / targetAmount) * 1000) / 10 : null,
      remaining,
      avgDailySalesNeeded: remaining !== null ? Math.round((remaining / (remainingDays || 1)) * 100) / 100 : null,
      predictedMonthEnd: elapsed > 0 ? Math.round((achieved / elapsed) * totalDays * 100) / 100 : achieved,
      forecastConfidence: Math.round((elapsed / totalDays) * 100) / 100,
    };
  }
}
