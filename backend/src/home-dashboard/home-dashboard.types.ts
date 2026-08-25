// Phase 16 — shared response shape for GET /home-dashboard/{owner|manager|consultant}.
// All three roles return this same shape; role-specific scoping happens
// inside HomeDashboardService, not in the response contract.

// id is a stable slug (e.g. 'deals-at-risk', 'target-progress', 'missed-eod',
// 'overdue-tasks', 'urgent-emails') — the frontend maps it to a drill-down
// route locally rather than the backend embedding a React Router path,
// consistent with how every other rule-based insight string in this app
// (aiInsight/aiRecommendation/aiCoaching) stays plain text with no
// frontend-routing knowledge baked in.
export interface AiRecommendation {
  id: string;
  text: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface CriticalAlertItem {
  id: string;
  title: string;
  meta: string;
  valueLabel?: string;
}

export type CriticalAlertKey = 'deals_at_risk' | 'overdue_tasks' | 'missed_eod' | 'urgent_emails';

// viewAllRoute intentionally omitted — same reasoning as AiRecommendation.id
// above; the frontend maps `key` to a route locally.
export interface CriticalAlertGroup {
  key: CriticalAlertKey;
  label: string;
  count: number;
  items: CriticalAlertItem[];
}

export interface EmailSummaryBucket {
  bucket: string;
  count: number;
}

export interface EmailSummaryItem {
  id: string;
  subject: string;
  from: string;
  intent: string;
  priority: string;
  receivedAt: string;
}

export interface TodaysEmailSummary {
  connected: boolean;
  mailboxEmail?: string;
  pendingCount: number;
  byIntentBucket: EmailSummaryBucket[];
  topItems: EmailSummaryItem[];
}

export interface CompactTimelineEvent {
  id: string;
  type: string;
  title: string;
  occurredAt: string;
}

export interface HomeDashboardOverview {
  generatedAt: string;
  aiRecommendations: AiRecommendation[];
  criticalAlerts: CriticalAlertGroup[];
  emailSummary: TodaysEmailSummary;
  timeline: CompactTimelineEvent[];
}
