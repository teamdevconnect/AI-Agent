import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Deal, DealDocument } from './schemas/deal.schema';
import { DealOwnerMapping, DealOwnerMappingDocument } from './schemas/deal-owner-mapping.schema';
import { UsersService } from '../users/users.service';

export interface ExternalOwnerRow {
  provider: string;
  externalOwnerRef: string;
  externalOwnerLabel?: string;
  dealCount: number;
  mapping: { id: string; ownerId: string; ownerName?: string } | null;
}

// The configurable half of "map the CRM's real deal-owner field to a real
// user" — see deal.schema.ts's own comment on externalOwnerRef for the full
// design. Provider-agnostic: this service never references "prospectconnect"
// by name, only whatever provider string each synced Deal itself carries.
@Injectable()
export class DealOwnerMappingService {
  constructor(
    @InjectModel(Deal.name) private dealModel: Model<DealDocument>,
    @InjectModel(DealOwnerMapping.name) private mappingModel: Model<DealOwnerMappingDocument>,
    private usersService: UsersService,
  ) {}

  // Every distinct raw external-owner value seen across this org's synced
  // deals, each with a deal count and its current mapping (if any) — the
  // full picture an admin needs to finish mapping every real salesperson at
  // once, not just react to one deal at a time.
  async listExternalOwners(organizationId: string): Promise<ExternalOwnerRow[]> {
    const [grouped, mappings, users] = await Promise.all([
      this.dealModel
        .aggregate<{ _id: { provider: string; ref: string }; label?: string; count: number }>([
          { $match: { organizationId, externalOwnerRef: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: { provider: '$externalOwnerProvider', ref: '$externalOwnerRef' },
              label: { $last: '$externalOwnerLabel' },
              count: { $sum: 1 },
            },
          },
        ])
        .exec(),
      this.mappingModel.find({ organizationId }).exec(),
      this.usersService.findAll(organizationId),
    ]);

    const userNameById = new Map(users.map((u) => [u._id.toString(), u.name]));
    const mappingByKey = new Map(mappings.map((m) => [`${m.provider}::${m.externalOwnerRef}`, m]));

    return grouped
      .map((g) => {
        const provider = g._id.provider ?? 'unknown';
        const ref = g._id.ref;
        const mapping = mappingByKey.get(`${provider}::${ref}`);
        return {
          provider,
          externalOwnerRef: ref,
          externalOwnerLabel: g.label,
          dealCount: g.count,
          mapping: mapping
            ? { id: mapping._id.toString(), ownerId: mapping.ownerId, ownerName: userNameById.get(mapping.ownerId) }
            : null,
        };
      })
      .sort((a, b) => b.dealCount - a.dealCount);
  }

  // Upserts the mapping AND immediately bulk-applies it to every existing
  // deal carrying this external owner ref — "ensure deal ownership data is
  // synchronized accurately", not just recorded for next sync. Overwrites
  // ownerId even on deals a human previously assigned manually: once a real
  // mapping exists for this salesperson, it becomes the authoritative
  // source going forward; a one-off manual override can still be applied
  // afterward via the existing per-deal Deal Assignment control.
  async upsertMapping(
    organizationId: string,
    provider: string,
    externalOwnerRef: string,
    externalOwnerLabel: string | undefined,
    ownerId: string,
    mappedBy: string,
  ): Promise<ExternalOwnerRow> {
    const mapping = await this.mappingModel
      .findOneAndUpdate(
        { organizationId, provider, externalOwnerRef },
        { $set: { externalOwnerLabel, ownerId, mappedBy } },
        { upsert: true, new: true },
      )
      .exec();

    const result = await this.dealModel.updateMany(
      { organizationId, externalOwnerProvider: provider, externalOwnerRef },
      { $set: { ownerId } },
    );

    const user = await this.usersService.findById(ownerId);
    return {
      provider,
      externalOwnerRef,
      externalOwnerLabel: mapping.externalOwnerLabel,
      dealCount: result.matchedCount,
      mapping: { id: mapping._id.toString(), ownerId, ownerName: user?.name },
    };
  }

  // Removes the mapping only — deliberately never retroactively unassigns
  // the deals it already applied to (those are now legitimately assigned;
  // silently mass-unassigning them on unmap would be a surprising,
  // destructive side effect). Use the existing per-deal control for any
  // one-off correction instead.
  async deleteMapping(organizationId: string, id: string): Promise<void> {
    const deleted = await this.mappingModel.findOneAndDelete({ _id: id, organizationId }).exec();
    if (!deleted) throw new NotFoundException('Mapping not found');
  }
}
