import { axiosClient } from '@/api/axiosClient';

export interface BusinessTableRow {
  key: string;
  businessName: string;
  businessNameSource: 'account' | 'quote_client_details' | 'deal_name_heuristic';
  quoteNumbers: string[];
  dealCount: number;
  quoteCount: number;
  openDealCount: number;
  wonCount: number;
  lostCount: number;
  isNew: boolean;
  isFollowUp: boolean;
  actionedToday: boolean;
}

export interface UnactionedItem {
  type: 'deal' | 'quote';
  id: string;
  name: string;
  businessName: string;
  daysSinceLastUpdate: number;
}

export interface LostWithReason {
  dealId: string;
  name: string;
  businessName: string;
  monetaryValue: number;
  lostReason: string | null;
  lostReasonSource: 'rep_reported' | 'ai_inferred' | null;
}

export interface CorrelatedEmail {
  id: string;
  subject: string;
  from: string;
  to: string[];
  receivedAt: string;
  preview: string;
  isRead: boolean;
  importance: string;
  matchConfidence: 'exact' | 'domain' | 'fuzzy';
  matchedBusinessKey: string;
  matchedBusinessName: string;
}

export interface CustomerActivitySummaryResult {
  prioritization: { businessName: string; rationale: string }[];
  missedImportantEmails: { emailId: string; subject: string; note: string }[];
  aiSummary: string;
  generatedAt: string;
}

export interface CustomerActivityOverview {
  date: string;
  timezone: string;
  businessTable: BusinessTableRow[];
  actionedTodayCounts: { existing: number; new: number; followUp: number };
  totalActionedToday: number;
  unactionedItems: UnactionedItem[];
  lostWithReason: LostWithReason[];
  todaysDigest: {
    actionedDeals: { dealId: string; name: string }[];
    actionedQuotes: { quoteId: string; name?: string; quoteNumber?: string }[];
  };
  correlatedEmails: CorrelatedEmail[];
  emailCorrelationCoverage: { exactMatchableContacts: number; note: string };
  summary: CustomerActivitySummaryResult | null;
  cached?: boolean;
}

export const customerActivityService = {
  async getOverview(): Promise<CustomerActivityOverview> {
    const { data } = await axiosClient.get<CustomerActivityOverview>('/crm/customer-activity/overview');
    return data;
  },

  async generateSummary(regenerate = false): Promise<CustomerActivityOverview> {
    const { data } = await axiosClient.post<CustomerActivityOverview>('/crm/customer-activity/generate-summary', { regenerate });
    return data;
  },

  // Consultant-only, always the caller's own data — no id param, matches
  // the backend route's self-scoped-only design.
  async getPersonalOverview(): Promise<CustomerActivityOverview> {
    const { data } = await axiosClient.get<CustomerActivityOverview>('/crm/customer-activity/personal-overview');
    return data;
  },

  async generatePersonalSummary(regenerate = false): Promise<CustomerActivityOverview> {
    const { data } = await axiosClient.post<CustomerActivityOverview>('/crm/customer-activity/generate-personal-summary', { regenerate });
    return data;
  },
};
