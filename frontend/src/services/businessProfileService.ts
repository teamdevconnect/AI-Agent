import { axiosClient } from '@/api/axiosClient';

export interface BusinessProfileFaq {
  question: string;
  answer: string;
}

export interface BusinessProfile {
  organizationId: string;
  businessName?: string;
  description?: string;
  industry?: string;
  website?: string;
  branches: string[];
  products: string[];
  services: string[];
  brands: string[];
  pricingPolicies?: string;
  salesProcess?: string;
  customerJourney?: string;
  targetAudience?: string;
  vision?: string;
  mission?: string;
  values: string[];
  faqs: BusinessProfileFaq[];
  termsAndConditions?: string;
  warrantyPolicy?: string;
  refundPolicy?: string;
  shippingPolicy?: string;
  businessRules?: string;
  standardOperatingProcedures?: string;
  salesGuidelines?: string;
  marketingGuidelines?: string;
  internalPolicies?: string;
  completenessPct: number;
}

export type UpsertBusinessProfilePayload = Partial<
  Omit<BusinessProfile, 'organizationId' | 'completenessPct'>
>;

export const businessProfileService = {
  async get(): Promise<BusinessProfile> {
    const { data } = await axiosClient.get<BusinessProfile>('/business-knowledge/profile');
    return data;
  },

  async upsert(payload: UpsertBusinessProfilePayload): Promise<BusinessProfile> {
    const { data } = await axiosClient.put<BusinessProfile>('/business-knowledge/profile', payload);
    return data;
  },
};
