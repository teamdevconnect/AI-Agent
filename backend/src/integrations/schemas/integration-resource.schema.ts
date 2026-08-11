import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type IntegrationResourceDocument = IntegrationResource & Document<Types.ObjectId>;

// A logical grouping of endpoints under a connected integration (see
// IntegrationCredential) — e.g. "Contacts", "Deals", "Enquiries" for a
// Salesforce/HubSpot/Gorilla Dash connection. Purely organizational: the
// Dynamic Executor (dynamic-executor.service.ts) only actually needs
// IntegrationEndpoint below, this exists so the AI/UI can group and browse
// endpoints by resource instead of one flat list per integration.
@Schema({ timestamps: true, collection: 'integration_resources' })
export class IntegrationResource {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, type: Types.ObjectId, index: true })
  integrationId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  // URL/id-safe slug (e.g. "contacts") — how endpoints and AI tool calls
  // reference this resource, distinct from the human-facing `name`.
  @Prop({ required: true })
  key: string;

  @Prop()
  description?: string;
}

export const IntegrationResourceSchema = SchemaFactory.createForClass(IntegrationResource);
IntegrationResourceSchema.index({ integrationId: 1, key: 1 }, { unique: true });
