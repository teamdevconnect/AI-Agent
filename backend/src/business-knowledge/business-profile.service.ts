import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { BusinessProfile, BusinessProfileDocument } from './schemas/business-profile.schema';
import { UpsertBusinessProfileDto } from './dto/upsert-business-profile.dto';

const TEXT_FIELDS: (keyof BusinessProfile)[] = [
  'businessName',
  'description',
  'industry',
  'website',
  'pricingPolicies',
  'salesProcess',
  'customerJourney',
  'targetAudience',
  'vision',
  'mission',
  'termsAndConditions',
  'warrantyPolicy',
  'refundPolicy',
  'shippingPolicy',
  'businessRules',
  'standardOperatingProcedures',
  'salesGuidelines',
  'marketingGuidelines',
  'internalPolicies',
];
const LIST_FIELDS: (keyof BusinessProfile)[] = ['branches', 'products', 'services', 'brands', 'values'];
// Every field counted for "completeness" — faqs counted separately below
// since it's neither a plain string nor a plain string[].
const COMPLETENESS_FIELD_COUNT = TEXT_FIELDS.length + LIST_FIELDS.length + 1;

function emptyProfile(organizationId: string) {
  return {
    organizationId,
    businessName: undefined,
    description: undefined,
    industry: undefined,
    website: undefined,
    branches: [],
    products: [],
    services: [],
    brands: [],
    pricingPolicies: undefined,
    salesProcess: undefined,
    customerJourney: undefined,
    targetAudience: undefined,
    vision: undefined,
    mission: undefined,
    values: [],
    faqs: [],
    termsAndConditions: undefined,
    warrantyPolicy: undefined,
    refundPolicy: undefined,
    shippingPolicy: undefined,
    businessRules: undefined,
    standardOperatingProcedures: undefined,
    salesGuidelines: undefined,
    marketingGuidelines: undefined,
    internalPolicies: undefined,
    completenessPct: 0,
  };
}

// Computed on read, never stored — same instinct as
// customer-activity.service.ts's emailCorrelationCoverage.
function completenessPct(profile: BusinessProfile): number {
  let filled = 0;
  for (const field of TEXT_FIELDS) if (profile[field]) filled += 1;
  for (const field of LIST_FIELDS) if ((profile[field] as string[] | undefined)?.length) filled += 1;
  if (profile.faqs?.length) filled += 1;
  return Math.round((filled / COMPLETENESS_FIELD_COUNT) * 100);
}

// Assembles the profile into one labeled text blob for RAG indexing —
// deliberately plain, readable prose (not JSON) since this is what a chat
// persona's retrieval snippet will literally quote back to a user.
function toSyncText(profile: BusinessProfile): string {
  const lines: string[] = [];
  const add = (label: string, value?: string | string[]) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return;
    lines.push(`${label}: ${Array.isArray(value) ? value.join(', ') : value}`);
  };
  add('Business name', profile.businessName);
  add('Description', profile.description);
  add('Industry', profile.industry);
  add('Website', profile.website);
  add('Branches', profile.branches);
  add('Products', profile.products);
  add('Services', profile.services);
  add('Brands', profile.brands);
  add('Pricing policies', profile.pricingPolicies);
  add('Sales process', profile.salesProcess);
  add('Customer journey', profile.customerJourney);
  add('Target audience', profile.targetAudience);
  add('Vision', profile.vision);
  add('Mission', profile.mission);
  add('Values', profile.values);
  for (const faq of profile.faqs ?? []) lines.push(`FAQ: Q: ${faq.question} A: ${faq.answer}`);
  add('Terms and conditions', profile.termsAndConditions);
  add('Warranty policy', profile.warrantyPolicy);
  add('Refund policy', profile.refundPolicy);
  add('Shipping policy', profile.shippingPolicy);
  add('Business rules', profile.businessRules);
  add('Standard operating procedures', profile.standardOperatingProcedures);
  add('Sales guidelines', profile.salesGuidelines);
  add('Marketing guidelines', profile.marketingGuidelines);
  add('Internal policies', profile.internalPolicies);
  return lines.join('\n');
}

@Injectable()
export class BusinessProfileService {
  private readonly logger = new Logger(BusinessProfileService.name);
  private readonly pythonAgentUrl: string;

  constructor(
    @InjectModel(BusinessProfile.name) private profileModel: Model<BusinessProfileDocument>,
    private http: HttpService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {
    this.pythonAgentUrl = this.config.get<string>('pythonAgentUrl') ?? 'http://localhost:8000';
  }

  async getOrDefault(organizationId: string) {
    const doc = await this.profileModel.findOne({ organizationId }).exec();
    if (!doc) return emptyProfile(organizationId);
    return { ...doc.toObject(), completenessPct: completenessPct(doc) };
  }

  async upsert(caller: JwtPayload, dto: UpsertBusinessProfileDto) {
    const doc = await this.profileModel
      .findOneAndUpdate(
        { organizationId: caller.organizationId },
        { $set: { ...dto, lastUpdatedBy: caller.sub } },
        { upsert: true, new: true },
      )
      .exec();

    // Best-effort, never blocks the save — mirrors agent-roles.service.ts's
    // publish-source call: a Qdrant sync failure shouldn't prevent the user
    // from saving their profile edits.
    try {
      const token = this.jwt.sign({ sub: caller.sub, organizationId: caller.organizationId }, { expiresIn: '5m' });
      const { data } = await firstValueFrom(
        this.http.post<{ documentId: string; chunkCount: number }>(
          `${this.pythonAgentUrl}/business-knowledge/profile/sync`,
          { organizationId: caller.organizationId, text: toSyncText(doc) },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      doc.vectorDocumentId = data.documentId;
      doc.vectorChunkCount = data.chunkCount;
      await doc.save();
    } catch (err) {
      this.logger.error(`Business profile Qdrant sync failed: ${(err as Error).message}`);
    }

    return { ...doc.toObject(), completenessPct: completenessPct(doc) };
  }
}
