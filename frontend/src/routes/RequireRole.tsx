import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { hasRole } from '@/utils/roles';
import { ROUTES } from '@/constants/routes';

/** Positive gate — only lets a caller through when they DO have `role`
 * (or, when given an array, any one of them). Used for the handful of
 * admin-only pages, and multi-role pages like /deal-performance. */
export function RequireRole({ role }: { role: string | string[] }) {
  const user = useAuthStore((state) => state.user);
  const roles = Array.isArray(role) ? role : [role];
  if (!roles.some((r) => hasRole(user, r))) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }
  return <Outlet />;
}
