import type { IconType } from 'react-icons';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: IconType;
  badge?: number;
}
