import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BusinessProfileDocument = BusinessProfile & Document<Types.ObjectId>;

// Deliberately its own sub-schema, not a shared FAQ type — question/answer
// pairs are specific to this one field.
@Schema({ _id: false })
export class BusinessProfileFaq {
  @Prop({ required: true })
  question: string;

  @Prop({ required: true })
  answer: string;
}
const BusinessProfileFaqSchema = SchemaFactory.createForClass(BusinessProfileFaq);

// One document per organization — the AI's permanent "business brain" of
// structured company knowledge (Phase 14a). Deliberately its own schema, not
// fields bolted onto Organization (which stays a pure tenant-identity
// schema — name/slug/status only) or Store (which already owns structured
// per-location hours/timezone; branches here stay free-text summaries, not
// a duplicate of that). businessName is intentionally distinct from
// Organization.name — a customer-facing/DBA name can legitimately differ
// from the tenant/login identity.
@Schema({ timestamps: true, collection: 'business_profiles' })
export class BusinessProfile {
  @Prop({ required: true, unique: true, index: true })
  organizationId: string;

  // ---- identity ----
  @Prop() businessName?: string;
  @Prop() description?: string;
  @Prop() industry?: string;
  @Prop() website?: string;
  @Prop({ type: [String], default: [] }) branches: string[];

  // ---- offering ----
  @Prop({ type: [String], default: [] }) products: string[];
  @Prop({ type: [String], default: [] }) services: string[];
  @Prop({ type: [String], default: [] }) brands: string[];

  // ---- commercial process (paragraph-shaped) ----
  @Prop() pricingPolicies?: string;
  @Prop() salesProcess?: string;
  @Prop() customerJourney?: string;
  @Prop() targetAudience?: string;

  // ---- culture ----
  @Prop() vision?: string;
  @Prop() mission?: string;
  @Prop({ type: [String], default: [] }) values: string[];
  @Prop({ type: [BusinessProfileFaqSchema], default: [] }) faqs: BusinessProfileFaq[];

  // ---- policies (paragraph-shaped) ----
  @Prop() termsAndConditions?: string;
  @Prop() warrantyPolicy?: string;
  @Prop() refundPolicy?: string;
  @Prop() shippingPolicy?: string;

  // ---- operating guidance (paragraph-shaped) ----
  @Prop() businessRules?: string;
  @Prop() standardOperatingProcedures?: string;
  @Prop() salesGuidelines?: string;
  @Prop() marketingGuidelines?: string;
  @Prop() internalPolicies?: string;

  // ---- RAG linkage — same fields Finance uses for the same purpose ----
  @Prop() vectorDocumentId?: string;
  @Prop({ default: 0 }) vectorChunkCount: number;

  @Prop() lastUpdatedBy?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const BusinessProfileSchema = SchemaFactory.createForClass(BusinessProfile);
