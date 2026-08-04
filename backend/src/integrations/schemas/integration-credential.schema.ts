import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type IntegrationCredentialDocument = IntegrationCredential & Document<Types.ObjectId>;

@Schema({ timestamps: true, collection: 'integration_credentials' })
export class IntegrationCredential {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true })
  provider: string;

  @Prop({ required: true })
  apiKey: string;

  @Prop()
  baseUrl?: string;
}

export const IntegrationCredentialSchema = SchemaFactory.createForClass(IntegrationCredential);
// One credential per (org, provider) — was a single global doc per provider
// shared by the entire deployment, which meant every tenant's chat agent
// used the same Anthropic/CRM key. Compound-unique replaces the old
// field-level `unique: true` on `provider` alone.
IntegrationCredentialSchema.index({ organizationId: 1, provider: 1 }, { unique: true });
