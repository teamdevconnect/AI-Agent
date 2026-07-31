import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrganizationDocument = Organization & Document<Types.ObjectId>;

// The tenant boundary. Every org-scoped collection (User, Store,
// IntegrationCredential, AgentRole, DailyReport, ...) carries this id and
// every service-layer query must filter on it — this is what makes the
// deployment multi-tenant rather than a single shared business.
@Schema({ timestamps: true, collection: 'organizations' })
export class Organization {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, index: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ enum: ['active', 'suspended'], default: 'active' })
  status: 'active' | 'suspended';
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
