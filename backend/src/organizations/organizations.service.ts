import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Organization, OrganizationDocument } from './schemas/organization.schema';
import { Store, StoreDocument } from './schemas/store.schema';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
    @InjectModel(Store.name) private storeModel: Model<StoreDocument>,
  ) {}

  /** Every new tenant gets exactly one store up front so the existing
   * single-store settings/cron/report flow keeps working unchanged for orgs
   * that never need more than one — additional stores are a later,
   * explicitly-triggered action (POST /organizations/stores), not required
   * just to finish signup. */
  async createOrganizationWithOwner(
    organizationName: string,
  ): Promise<{ organization: OrganizationDocument; store: StoreDocument }> {
    const slug = await this.uniqueSlug(organizationName);
    const organization = await this.orgModel.create({ name: organizationName, slug });
    const store = await this.storeModel.create({
      organizationId: organization._id.toString(),
      name: `${organizationName} — Main Store`,
    });
    return { organization, store };
  }

  findOrgById(id: string) {
    return this.orgModel.findById(id).exec();
  }

  listStores(organizationId: string) {
    return this.storeModel.find({ organizationId }).sort({ createdAt: 1 }).exec();
  }

  async createStore(organizationId: string, data: { name: string; address?: string }) {
    return this.storeModel.create({ organizationId, ...data });
  }

  /** Resolves which store a request should act on: the caller's own store if
   * they have one and it still belongs to their org, otherwise the org's
   * oldest (default) store. Throws if the org somehow has none — shouldn't
   * happen since every org is created with one, but a deleted-store edge
   * case shouldn't silently operate on a stranger's data. */
  async resolveStoreForUser(organizationId: string, userStoreId?: string): Promise<StoreDocument> {
    if (userStoreId) {
      const owned = await this.storeModel.findOne({ _id: userStoreId, organizationId }).exec();
      if (owned) return owned;
    }
    const fallback = await this.storeModel.findOne({ organizationId }).sort({ createdAt: 1 }).exec();
    if (!fallback) throw new NotFoundException('No store configured for this organization');
    return fallback;
  }

  async updateStoreSettings(
    organizationId: string,
    userStoreId: string | undefined,
    patch: { openingTime?: string; closingTime?: string; timezone?: string },
  ) {
    const store = await this.resolveStoreForUser(organizationId, userStoreId);
    Object.assign(store, patch);
    await store.save();
    return store;
  }

  /** Cron-only: not scoped to any single caller, iterates every store across
   * every tenant so StoreSettingsService's fixed-cadence checker can evaluate
   * each store's own opening/closing window independently. */
  listAllStores() {
    return this.storeModel.find().exec();
  }

  /** Atomically checks-and-marks in one write, closing the race window a
   * separate "read from the cron's already-fetched list, then write later"
   * approach leaves open — two overlapping evaluations (a horizontally
   * scaled second instance, or a manual catch-up run overlapping the live
   * cron tick) could otherwise both see `lastMorningRunDate !== date` as
   * true before either had persisted its own update, and both proceed to
   * generate a duplicate scheduled report. The `lastMorningRunDate: {$ne:
   * date}` filter makes the claim itself the dedupe check — only the
   * caller whose update actually matched a document (returned truthy) has
   * legitimately "won" and should proceed with `runForStore`. */
  async claimMorningRun(storeId: string, date: string): Promise<boolean> {
    const result = await this.storeModel
      .updateOne({ _id: storeId, lastMorningRunDate: { $ne: date } }, { lastMorningRunDate: date })
      .exec();
    return result.modifiedCount > 0;
  }

  async claimEodRun(storeId: string, date: string): Promise<boolean> {
    const result = await this.storeModel
      .updateOne({ _id: storeId, lastEodRunDate: { $ne: date } }, { lastEodRunDate: date })
      .exec();
    return result.modifiedCount > 0;
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'org';
    let candidate = base;
    let n = 2;
    while (await this.orgModel.exists({ slug: candidate })) {
      candidate = `${base}-${n++}`;
    }
    return candidate;
  }
}
