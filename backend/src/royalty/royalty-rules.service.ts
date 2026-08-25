import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RoyaltyRule, RoyaltyRuleDocument, RoyaltySlidingTier } from './schemas/royalty-rule.schema';
import { CreateRoyaltyRuleDto } from './dto/create-royalty-rule.dto';
import { UpdateRoyaltyRuleDto } from './dto/update-royalty-rule.dto';

@Injectable()
export class RoyaltyRulesService {
  constructor(@InjectModel(RoyaltyRule.name) private ruleModel: Model<RoyaltyRuleDocument>) {}

  // The method the future Phase 20b calculation engine calls for any report
  // period — resolves whichever version was actually in effect on a given
  // date, never the merely-latest one, so a report for a past period stays
  // correct even after the rule has since changed.
  getEffectiveRule(organizationId: string, asOfDate: Date) {
    return this.ruleModel
      .findOne({ organizationId, effectiveDate: { $lte: asOfDate } })
      .sort({ effectiveDate: -1 })
      .exec();
  }

  getCurrentRule(organizationId: string) {
    return this.getEffectiveRule(organizationId, new Date());
  }

  listHistory(organizationId: string) {
    return this.ruleModel.find({ organizationId }).sort({ effectiveDate: -1 }).exec();
  }

  async createVersion(organizationId: string, dto: CreateRoyaltyRuleDto, createdBy: string) {
    this.validateTiers(dto.capType, dto.slidingTiers);
    return this.ruleModel.create({
      organizationId,
      ...dto,
      effectiveDate: new Date(dto.effectiveDate),
      createdBy,
    });
  }

  // Only a not-yet-live version may be edited — once a version's
  // effectiveDate has passed, a real report may already have been generated
  // against it, so it can only be superseded by a new version (createVersion),
  // never rewritten in place.
  async updateFutureVersion(id: string, organizationId: string, dto: UpdateRoyaltyRuleDto) {
    const existing = await this.ruleModel.findOne({ _id: id, organizationId }).exec();
    if (!existing) throw new NotFoundException('Royalty rule version not found');
    if (existing.effectiveDate.getTime() <= Date.now()) {
      throw new ForbiddenException('Only a not-yet-effective royalty rule version can be edited');
    }
    if (dto.capType !== undefined || dto.slidingTiers !== undefined) {
      this.validateTiers(dto.capType ?? existing.capType, dto.slidingTiers ?? existing.slidingTiers);
    }

    const { effectiveDate, ...rest } = dto;
    const update: Record<string, unknown> = { ...rest };
    if (effectiveDate) update.effectiveDate = new Date(effectiveDate);

    const updated = await this.ruleModel
      .findOneAndUpdate({ _id: id, organizationId }, { $set: update }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Royalty rule version not found');
    return updated;
  }

  private validateTiers(
    capType: string | undefined,
    tiers: Pick<RoyaltySlidingTier, 'fromValue' | 'toValue' | 'percentage'>[] | undefined,
  ) {
    if (capType !== 'sliding') return;
    if (!tiers?.length) {
      throw new ForbiddenException('At least one sliding tier is required for capType "sliding"');
    }
    const sorted = [...tiers].sort((a, b) => a.fromValue - b.fromValue);
    for (let i = 0; i < sorted.length; i++) {
      const tier = sorted[i];
      const next = sorted[i + 1];
      if (tier.toValue !== undefined && tier.toValue <= tier.fromValue) {
        throw new ForbiddenException("Each sliding tier's toValue must be greater than its fromValue");
      }
      if (next && tier.toValue !== undefined && tier.toValue > next.fromValue) {
        throw new ForbiddenException('Sliding tiers must not overlap');
      }
    }
  }
}
