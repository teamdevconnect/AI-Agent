import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DealOwnerMappingDocument = DealOwnerMapping & Document<Types.ObjectId>;

// The configurable half of deal-owner resolution — see deal.schema.ts's own
// comment on externalOwnerRef for the full picture. One row per (org,
// provider, raw external owner id), pointing at a real internal User._id.
// Provider-agnostic by construction: a future HubSpot/Zoho/Salesforce sync
// only needs to populate Deal.externalOwnerRef/externalOwnerProvider with
// its own real field names — this schema, the resolution/bulk-apply logic,
// and the Settings → Deal Assignment mapping UI all stay unchanged.
@Schema({ timestamps: true, collection: 'crm_deal_owner_mappings' })
export class DealOwnerMapping {
  @Prop({ required: true, index: true })
  organizationId: string;

  // e.g. 'prospectconnect' today; 'hubspot' | 'zoho' | 'salesforce' once
  // those integrations exist — free text, not a Mongoose enum, so adding a
  // new provider is a data change, never a schema migration.
  @Prop({ required: true })
  provider: string;

  @Prop({ required: true })
  externalOwnerRef: string;

  // Snapshot of Deal.externalOwnerLabel at the time this mapping was saved
  // — purely informational (re-displaying the mapping later without a
  // second lookup), never authoritative over whatever the sync currently sees.
  @Prop()
  externalOwnerLabel?: string;

  @Prop({ required: true, index: true })
  ownerId: string;

  @Prop({ required: true })
  mappedBy: string;

  createdAt: Date;
  updatedAt: Date;
}

export const DealOwnerMappingSchema = SchemaFactory.createForClass(DealOwnerMapping);
// One mapping per (org, provider, external owner) — saving again for the
// same triple updates the existing row (see the service's upsert), never
// creates a duplicate.
DealOwnerMappingSchema.index({ organizationId: 1, provider: 1, externalOwnerRef: 1 }, { unique: true });
