import type { IconType } from 'react-icons';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: IconType;
  badge?: number;
  // Only agent_user ever populates this — admin/legacy user roles always see everything.
  hideForRoles?: string[];
}
