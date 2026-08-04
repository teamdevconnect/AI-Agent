import { axiosClient } from '@/api/axiosClient';
import type { EmailIntelligenceItem } from './emailIntelligenceService';

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

export interface RelationshipViewAccount {
  name: string;
  domain?: string;
  city?: string;
  industry?: string;
  revenue?: number;
}

export interface RelationshipViewQuote {
  id: string;
  quoteNumber: string | null;
  quoteName: string | null;
  quoteStatus: string;
  quoteAmount: number;
  currency: string;
  clientDetails: { companyName?: string; contactName?: string; email?: string; phone?: string } | null;
  dealId: string | null;
  // Additive (Phase 14c) — used by the Customer Timeline merge.
  createdAt: string | null;
}

export interface RelationshipViewDeal {
  id: string;
  name: string;
  dealStatus: string;
  monetaryValue: number;
  expectedClosingDate: string | null;
  stageId: string | null;
  // Additive (Phase 14c) — same reasoning as RelationshipViewQuote.createdAt.
  createdAt: string | null;
}

export interface RelationshipView {
  key: string;
  businessName: string;
  businessNameSource: 'account' | 'quote_client_details' | 'deal_name_heuristic';
  account: RelationshipViewAccount | null;
  quotes: RelationshipViewQuote[];
  deals: RelationshipViewDeal[];
  // Deliberately today-only — see backend plan notes (Phase 14a).
  correlatedEmails: CorrelatedEmail[];
}

export interface CustomerTimelineEntry {
  type: 'deal_created' | 'quote_created' | 'email';
  date: string;
  title: string;
  description: string;
}

// Strict superset of RelationshipView — the Customer Timeline endpoint
// (Phase 14c) wraps the same relationship data and adds real historical
// email context (not just today's), a deterministic risk score, and
// lifetime value.
export interface CustomerTimeline extends RelationshipView {
  emailHistory: EmailIntelligenceItem[];
  lifetimeValue: number;
  riskScore: number;
  riskLabel: 'Healthy' | 'Needs Attention' | 'At Risk';
  timeline: CustomerTimelineEntry[];
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

  // businessKey can contain arbitrary characters (spaces, "@", ":") since
  // it's a normalized heuristic/email-derived string when no real Account
  // is linked — always encodeURIComponent before it reaches the URL.
  async getRelationshipView(businessKey: string): Promise<RelationshipView> {
    const { data } = await axiosClient.get<RelationshipView>(`/crm/customer-activity/relationships/${encodeURIComponent(businessKey)}`);
    return data;
  },

  async getPersonalRelationshipView(businessKey: string): Promise<RelationshipView> {
    const { data } = await axiosClient.get<RelationshipView>(
      `/crm/customer-activity/personal-relationships/${encodeURIComponent(businessKey)}`,
    );
    return data;
  },

  // Phase 14c — a strict superset of getRelationshipView (real historical
  // email context, risk score, lifetime value). Route lives under the same
  // '/crm/customer-activity' prefix even though it's served by a different
  // backend module (EmailIntelligenceModule) — see backend plan notes.
  async getCustomerTimeline(businessKey: string): Promise<CustomerTimeline> {
    const { data } = await axiosClient.get<CustomerTimeline>(`/crm/customer-activity/timeline/${encodeURIComponent(businessKey)}`);
    return data;
  },

  async getPersonalCustomerTimeline(businessKey: string): Promise<CustomerTimeline> {
    const { data } = await axiosClient.get<CustomerTimeline>(
      `/crm/customer-activity/personal-timeline/${encodeURIComponent(businessKey)}`,
    );
    return data;
  },
};
