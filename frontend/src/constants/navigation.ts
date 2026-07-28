<<<<<<< HEAD
import { FiLink2, FiSettings } from 'react-icons/fi';
=======
import { FiActivity, FiCheckSquare, FiLink2, FiSettings } from 'react-icons/fi';
>>>>>>> 6a60a8648 (Initial AI Agent source code)
import { ROUTES } from './routes';
import type { NavItem } from '@/types';

export const PRIMARY_NAV_ITEMS: NavItem[] = [
<<<<<<< HEAD
  { id: 'integrations', label: 'Integrations', path: ROUTES.integrations, icon: FiLink2 },
];

export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { id: 'settings', label: 'Settings', path: ROUTES.settings, icon: FiSettings },
=======
  { id: 'dashboard', label: 'AI Workforce Dashboard', path: ROUTES.dashboard, icon: FiActivity },
  { id: 'todo-eod', label: 'To-Do / EOD', path: ROUTES.todoEod, icon: FiCheckSquare },
  { id: 'integrations', label: 'Integrations', path: ROUTES.integrations, icon: FiLink2, hideForRoles: ['agent_user'] },
];

export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { id: 'settings', label: 'Settings', path: ROUTES.settings, icon: FiSettings, hideForRoles: ['agent_user'] },
>>>>>>> 6a60a8648 (Initial AI Agent source code)
];
