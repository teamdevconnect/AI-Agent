import { FiActivity, FiBarChart2, FiBookOpen, FiCheckSquare, FiClock, FiDollarSign, FiInbox, FiLink2, FiPieChart, FiSettings, FiTerminal } from 'react-icons/fi';
import { ROUTES } from './routes';
import type { NavItem } from '@/types';

// Phase 15: section labels drive the sidebar's grouped-header render
// (Sidebar.tsx) — purely presentational, computed after hideForRoles
// filtering, so this grouping has zero effect on who sees which item.
export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: ROUTES.dashboard, icon: FiBarChart2, section: 'Overview' },
  { id: 'agent-activity', label: 'Agent Activity', path: ROUTES.agentActivity, icon: FiActivity, section: 'Overview' },
  { id: 'timeline', label: 'Timeline', path: ROUTES.timeline, icon: FiClock, section: 'Overview' },
  {
    id: 'business-knowledge',
    label: 'Business Knowledge',
    path: ROUTES.businessKnowledge,
    icon: FiBookOpen,
    section: 'Sales & CRM',
    // Owner/admin/manager only, matching CRM-dashboard-tier visibility (see
    // Phase 14a plan notes) — not Finance's tighter owner/admin-only tier,
    // since this is ordinary operational context, not sensitive vendor data.
    hideForRoles: ['agent_user', 'user', 'consultant'],
  },
  {
    id: 'email-intelligence',
    label: 'AI Email Inbox',
    path: ROUTES.emailIntelligence,
    icon: FiInbox,
    section: 'Sales & CRM',
    // Self-scoped to the caller's own connected mailbox — every real role
    // benefits, hidden only for agent_user (an AI-persona account, not a
    // real salesperson mailbox), same precedent as the Integrations item.
    hideForRoles: ['agent_user'],
  },
  {
    id: 'command-center',
    label: 'Command Center',
    path: ROUTES.commandCenter,
    icon: FiTerminal,
    section: 'Operations',
    // Admin-only surface (cost/token data across the whole org) — hidden
    // for every role except owner/admin, mirroring the org creator's
    // ['owner','admin'] roles from Phase 1.
    hideForRoles: ['agent_user', 'user', 'manager', 'consultant'],
  },
  {
    id: 'finance',
    label: 'Finance AI',
    path: ROUTES.finance,
    icon: FiDollarSign,
    section: 'Operations',
    // Owner/admin only — vendor bank details and payment amounts are more
    // sensitive than deal pipeline data, and Finance is org-wide with no
    // store scoping, so managers have no narrower fallback view the way
    // they do everywhere else (see Phase 10a plan notes).
    hideForRoles: ['agent_user', 'user', 'manager', 'consultant'],
  },
  {
    id: 'reporting',
    label: 'Reporting',
    path: ROUTES.reporting,
    icon: FiPieChart,
    section: 'Operations',
    // Same RBAC tier as the report endpoints it calls (Sales/Gross
    // Margin/Royalty are all owner/admin/manager, manager store-scoped).
    hideForRoles: ['agent_user', 'user', 'consultant'],
  },
  { id: 'todo-eod', label: 'To-Do / EOD', path: ROUTES.todoEod, icon: FiCheckSquare, section: 'Operations' },
  {
    id: 'integrations',
    label: 'Integrations',
    path: ROUTES.integrations,
    icon: FiLink2,
    section: 'Operations',
    hideForRoles: ['agent_user'],
  },
];

export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { id: 'settings', label: 'Settings', path: ROUTES.settings, icon: FiSettings, hideForRoles: ['agent_user'] },
];
