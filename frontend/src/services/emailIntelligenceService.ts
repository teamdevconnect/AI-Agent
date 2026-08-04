import { axiosClient } from '@/api/axiosClient';

export const EMAIL_INTELLIGENCE_INTENTS = [
  'new_enquiry',
  'existing_customer',
  'quotation_request',
  'price_negotiation',
  'complaint',
  'technical_support',
  'payment',
  'purchase_order',
  'vendor',
  'refund',
  'meeting_request',
  'escalation',
  'internal',
  'spam',
  'other',
] as const;

export interface MatchedQuoteSummary {
  quoteNumber?: string;
  quoteName?: string;
  quoteAmount: number;
  currency: string;
  quoteStatus: string;
}

export interface MatchedBusinessSummary {
  openDealCount: number;
  wonDealCount: number;
  // Never a cost/margin/discount field — no real pricing data exists yet
  // (see Phase 14b plan notes).
  previousQuotes: MatchedQuoteSummary[];
}

export interface EmailIntelligenceItem {
  _id: string;
  organizationId: string;
  userId: string;
  mailboxEmail: string;
  externalMessageId: string;
  receivedAt: string;
  subject: string;
  fromAddress: string;
  toAddresses: string[];
  bodyPreview: string;
  isRead: boolean;
  importance: string;
  matchConfidence: 'exact' | 'domain' | 'fuzzy' | 'none';
  matchedBusinessKey?: string;
  matchedBusinessName?: string;
  matchedBusinessSummary?: MatchedBusinessSummary;
  intent: (typeof EMAIL_INTELLIGENCE_INTENTS)[number];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated';
  recommendedAction: string;
  shouldDraft: boolean;
  draftReply?: string;
  draftReasoning?: string;
  status: 'pending' | 'approved' | 'rejected';
  finalDraftReply?: string;
  wasEdited: boolean;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  regeneratedCount: number;
  lastRegeneratedAt?: string;
  // Phase 14d — set only after a real, successful send. Absence with
  // status === 'approved' means "approved but not yet sent."
  sentAt?: string;
  sendError?: string;
  createdAt: string;
  updatedAt: string;
}

export const emailIntelligenceService = {
  async list(status?: 'pending' | 'approved' | 'rejected'): Promise<EmailIntelligenceItem[]> {
    const { data } = await axiosClient.get<EmailIntelligenceItem[]>('/email-intelligence', {
      params: status ? { status } : undefined,
    });
    return data;
  },

  async getOne(id: string): Promise<EmailIntelligenceItem> {
    const { data } = await axiosClient.get<EmailIntelligenceItem>(`/email-intelligence/${id}`);
    return data;
  },

  async approve(id: string, finalDraftReply?: string): Promise<EmailIntelligenceItem> {
    const { data } = await axiosClient.post<EmailIntelligenceItem>(`/email-intelligence/${id}/approve`, { finalDraftReply });
    return data;
  },

  async reject(id: string, reason?: string): Promise<EmailIntelligenceItem> {
    const { data } = await axiosClient.post<EmailIntelligenceItem>(`/email-intelligence/${id}/reject`, { reason });
    return data;
  },

  async regenerate(id: string): Promise<EmailIntelligenceItem> {
    const { data } = await axiosClient.post<EmailIntelligenceItem>(`/email-intelligence/${id}/regenerate`);
    return data;
  },

  // Phase 14d — the only call that actually dispatches a real email. Only
  // valid on an already-approved item; the caller is responsible for its
  // own confirmation step before invoking this (see EmailIntelligenceDetailModal.tsx).
  async send(id: string): Promise<EmailIntelligenceItem> {
    const { data } = await axiosClient.post<EmailIntelligenceItem>(`/email-intelligence/${id}/send`);
    return data;
  },
};
