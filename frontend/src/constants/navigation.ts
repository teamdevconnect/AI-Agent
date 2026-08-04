import { FiActivity, FiBarChart2, FiBookOpen, FiCheckSquare, FiClock, FiDollarSign, FiInbox, FiLink2, FiSettings, FiTerminal, FiTrendingUp } from 'react-icons/fi';
import { ROUTES } from './routes';
import type { NavItem } from '@/types';

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: ROUTES.dashboard, icon: FiBarChart2 },
  { id: 'agent-activity', label: 'Agent Activity', path: ROUTES.agentActivity, icon: FiActivity },
  { id: 'timeline', label: 'Timeline', path: ROUTES.timeline, icon: FiClock },
  {
    id: 'deal-performance',
    label: 'Deal Performance',
    path: ROUTES.dealPerformance,
    icon: FiTrendingUp,
    // Owner/admin/manager only — consultants already have their own
    // personal ConsultantDashboardView (see Phase 9a plan notes).
    hideForRoles: ['agent_user', 'user', 'consultant'],
  },
  {
    id: 'command-center',
    label: 'Command Center',
    path: ROUTES.commandCenter,
    icon: FiTerminal,
    // Admin-only surface (cost/token data across the whole org) — hidden
    // for every role except owner/admin, mirroring the org creator's
    // ['owner','admin'] roles from Phase 1.
    hideForRoles: ['agent_user', 'user', 'manager', 'consultant'],
  },
  {
    id: 'business-knowledge',
    label: 'Business Knowledge',
    path: ROUTES.businessKnowledge,
    icon: FiBookOpen,
    // Owner/admin/manager only, matching CRM-dashboard-tier visibility (see
    // Phase 14a plan notes) — not Finance's tighter owner/admin-only tier,
    // since this is ordinary operational context, not sensitive vendor data.
    hideForRoles: ['agent_user', 'user', 'consultant'],
  },
  {
    id: 'finance',
    label: 'Finance AI',
    path: ROUTES.finance,
    icon: FiDollarSign,
    // Owner/admin only — vendor bank details and payment amounts are more
    // sensitive than deal pipeline data, and Finance is org-wide with no
    // store scoping, so managers have no narrower fallback view the way
    // they do everywhere else (see Phase 10a plan notes).
    hideForRoles: ['agent_user', 'user', 'manager', 'consultant'],
  },
  { id: 'todo-eod', label: 'To-Do / EOD', path: ROUTES.todoEod, icon: FiCheckSquare },
  {
    id: 'email-intelligence',
    label: 'AI Email Inbox',
    path: ROUTES.emailIntelligence,
    icon: FiInbox,
    // Self-scoped to the caller's own connected mailbox — every real role
    // benefits, hidden only for agent_user (an AI-persona account, not a
    // real salesperson mailbox), same precedent as the Integrations item.
    hideForRoles: ['agent_user'],
  },
  { id: 'integrations', label: 'Integrations', path: ROUTES.integrations, icon: FiLink2, hideForRoles: ['agent_user'] },
];

export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { id: 'settings', label: 'Settings', path: ROUTES.settings, icon: FiSettings, hideForRoles: ['agent_user'] },
];
