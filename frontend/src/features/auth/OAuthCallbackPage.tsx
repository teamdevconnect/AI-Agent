import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Spinner } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { ROUTES } from '@/constants/routes';

/** Landing page for the backend's OAuth redirect (see auth/oauth.controller.ts's
 * callback, which redirects here with ?token=<jwt> once Google/Microsoft/GitHub
 * sign-in succeeds). Applies the session client-side, same as password login,
 * then forwards into the app. */
export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loginWithToken = useAuthStore((state) => state.loginWithToken);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = searchParams.get('token');
    if (!token) {
      toast.error('Sign-in failed — no token received');
      navigate(ROUTES.login, { replace: true });
      return;
    }

    loginWithToken(token)
      .then(() => {
        toast.success('Welcome back!');
        navigate(ROUTES.chat, { replace: true });
      })
      .catch(() => {
        toast.error('Sign-in failed');
        navigate(ROUTES.login, { replace: true });
      });
  }, [searchParams, navigate, loginWithToken]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Spinner size={32} />
    </div>
  );
}
