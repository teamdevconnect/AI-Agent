import { FiLink2, FiSettings } from 'react-icons/fi';
import { ROUTES } from './routes';
import type { NavItem } from '@/types';

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { id: 'integrations', label: 'Integrations', path: ROUTES.integrations, icon: FiLink2 },
];

export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { id: 'settings', label: 'Settings', path: ROUTES.settings, icon: FiSettings },
];
