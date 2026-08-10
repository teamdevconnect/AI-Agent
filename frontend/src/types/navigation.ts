import type { IconType } from 'react-icons';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: IconType;
  badge?: number;
  // Only agent_user ever populates this — admin/legacy user roles always see everything.
  hideForRoles?: string[];
  // Groups PRIMARY_NAV_ITEMS under a static section header in the sidebar
  // (see Sidebar.tsx) — purely presentational, no effect on hideForRoles
  // filtering. Unset items (e.g. SECONDARY_NAV_ITEMS) render ungrouped.
  section?: string;
}
