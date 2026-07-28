import type { IconType } from 'react-icons';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: IconType;
  badge?: number;
<<<<<<< HEAD
=======
  // Only agent_user ever populates this — admin/legacy user roles always see everything.
  hideForRoles?: string[];
>>>>>>> 6a60a8648 (Initial AI Agent source code)
}
