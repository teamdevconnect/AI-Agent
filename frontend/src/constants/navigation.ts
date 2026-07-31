import { FiActivity, FiBarChart2, FiCheckSquare, FiClock, FiLink2, FiSettings, FiTerminal, FiTrendingUp } from 'react-icons/fi';
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
  { id: 'todo-eod', label: 'To-Do / EOD', path: ROUTES.todoEod, icon: FiCheckSquare },
  { id: 'integrations', label: 'Integrations', path: ROUTES.integrations, icon: FiLink2, hideForRoles: ['agent_user'] },
];

export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { id: 'settings', label: 'Settings', path: ROUTES.settings, icon: FiSettings, hideForRoles: ['agent_user'] },
];
