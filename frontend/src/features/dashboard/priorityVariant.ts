import type { DashboardTask } from '@/services/dashboardService';

export const PRIORITY_VARIANT: Record<DashboardTask['priority'], 'danger' | 'warning' | 'accent' | 'neutral'> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'accent',
  low: 'neutral',
};
