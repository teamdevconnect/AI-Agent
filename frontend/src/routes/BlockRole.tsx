import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { hasRole } from '@/utils/roles';
import { ROUTES } from '@/constants/routes';

/** Negative gate — blocks a caller who DOES have `role`. Only agent_user is
 * ever blocked by anything; admin and legacy user roles always fall through. */
export function BlockRole({ role }: { role: string }) {
  const user = useAuthStore((state) => state.user);
  if (hasRole(user, role)) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }
  return <Outlet />;
}
