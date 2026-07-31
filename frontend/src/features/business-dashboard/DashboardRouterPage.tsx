import { useAuthStore } from '@/stores/authStore';
import { hasRole } from '@/utils/roles';
import { DashboardPage as AgentWorkforceDashboardPage } from '@/features/dashboard/DashboardPage';
import { OwnerDashboardView } from './OwnerDashboardView';
import { ManagerDashboardView } from './ManagerDashboardView';
import { ConsultantDashboardView } from './ConsultantDashboardView';

// Role dispatch for the primary "/dashboard" landing page — the business
// hierarchy roles (owner/manager/consultant) each get their own KPI view.
// Accounts with none of those (a plain admin or agent_user account with no
// business-hierarchy role assigned) fall back to the original AI-workforce
// dashboard, so nothing existing becomes unreachable.
export function DashboardRouterPage() {
  const user = useAuthStore((s) => s.user);

  if (hasRole(user, 'owner')) return <OwnerDashboardView />;
  if (hasRole(user, 'manager')) return <ManagerDashboardView />;
  if (hasRole(user, 'consultant')) return <ConsultantDashboardView />;
  return <AgentWorkforceDashboardPage />;
}
