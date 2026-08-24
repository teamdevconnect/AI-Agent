import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { hasRole } from '@/utils/roles';
import { ADMIN_ROUTES } from '@/constants/routes';

// Reuses the exact same JWT session (useAuthStore) as the rest of the app —
// this is a separate UI area, not a separate authentication system. Backend
// enforcement is independent and authoritative (every /Admin-haive-facing
// route is @Roles('platform_admin') server-side); this guard only spares a
// non-admin the flash of an admin shell they have no data access to.
export function AdminProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!isAuthenticated || !hasRole(user, 'platform_admin')) {
    return <Navigate to={ADMIN_ROUTES.signin} replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function AdminPublicOnlyRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  if (isAuthenticated && hasRole(user, 'platform_admin')) {
    return <Navigate to={ADMIN_ROUTES.dashboard} replace />;
  }

  return <Outlet />;
}
