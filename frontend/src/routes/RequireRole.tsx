import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { hasRole } from '@/utils/roles';
import { ROUTES } from '@/constants/routes';

/** Positive gate — only lets a caller through when they DO have `role`.
 * Used for the handful of admin-only pages. */
export function RequireRole({ role }: { role: string }) {
  const user = useAuthStore((state) => state.user);
  if (!hasRole(user, role)) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }
  return <Outlet />;
}
