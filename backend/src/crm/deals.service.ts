import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Deal, DealDocument } from './schemas/deal.schema';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { DealFilterQueryDto } from './dto/deal-filter-query.dto';
import { ListDealsQueryDto } from './dto/list-deals-query.dto';
import { buildDealMatchStage } from './deal-filter.util';

@Injectable()
export class DealsService {
  constructor(@InjectModel(Deal.name) private dealModel: Model<DealDocument>) {}

  list(organizationId: string, storeId?: string) {
    return this.dealModel
      .find({ organizationId, ...(storeId ? { storeId } : {}) })
      .sort({ expectedClosingDate: -1 })
      .exec();
  }

  // storeId, when passed, scopes the match itself (not just the input) —
  // a manager can only ever touch a deal that's actually in their own store,
  // regardless of what the caller claims.
  async assignOwner(id: string, organizationId: string, ownerId: string | null, storeId?: string) {
    const filter = { _id: id, organizationId, ...(storeId ? { storeId } : {}) };
    const update = ownerId ? { $set: { ownerId } } : { $unset: { ownerId: '' } };
    const updated = await this.dealModel.findOneAndUpdate(filter, update, { new: true }).exec();
    if (!updated) throw new NotFoundException('Deal not found');
    return updated;
  }

  create(organizationId: string, dto: CreateDealDto, storeConstraint?: string) {
    return this.dealModel.create({ organizationId, ...dto, storeId: storeConstraint ?? dto.storeId });
  }

  async update(id: string, organizationId: string, dto: UpdateDealDto, storeConstraint?: string) {
    const filter = { _id: id, organizationId, ...(storeConstraint ? { storeId: storeConstraint } : {}) };
    // lostReasonSource is never client-settable (see UpdateDealDto's
    // comment) — server-stamped 'rep_reported' the moment a real reason
    // arrives, reserving 'ai_inferred' for a future inference job only.
    const update = dto.lostReason?.trim() ? { ...dto, lostReasonSource: 'rep_reported' as const } : dto;
    const updated = await this.dealModel.findOneAndUpdate(filter, { $set: update }, { new: true }).exec();
    if (!updated) throw new NotFoundException('Deal not found');
    return updated;
  }

  async findOne(id: string, organizationId: string, storeConstraint?: string) {
    const filter = { _id: id, organizationId, ...(storeConstraint ? { storeId: storeConstraint } : {}) };
    const deal = await this.dealModel.findOne(filter).exec();
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  async listFiltered(organizationId: string, query: ListDealsQueryDto, storeConstraint?: string) {
    const match = buildDealMatchStage(organizationId, query, storeConstraint);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const sortBy = query.sortBy ?? 'expectedClosingDate';
    const sortDir = query.sortDir === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      this.dealModel
        .find(match)
        .sort({ [sortBy]: sortDir })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      this.dealModel.countDocuments(match).exec(),
    ]);
    return { items, total, page, pageSize };
  }

  // Ignores client-supplied pagination — export always pulls up to `cap`
  // rows in one pass, with an explicit truncated flag rather than a silent
  // partial result.
  async listForExport(organizationId: string, filters: DealFilterQueryDto, storeConstraint: string | undefined, cap: number) {
    const match = buildDealMatchStage(organizationId, filters, storeConstraint);
    const items = await this.dealModel
      .find(match)
      .sort({ expectedClosingDate: -1 })
      .limit(cap + 1)
      .exec();
    const truncated = items.length > cap;
    return { items: truncated ? items.slice(0, cap) : items, truncated };
  }
}
