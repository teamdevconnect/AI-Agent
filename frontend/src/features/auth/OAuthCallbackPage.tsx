import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Spinner } from '@/components/ui';
import { AuthLayout } from '@/layouts/AuthLayout/AuthLayout';
import { useAuthStore } from '@/stores/authStore';
import { extractErrorMessage } from '@/utils/errors';
import { ROUTES } from '@/constants/routes';
import { TwoFactorChallengeForm } from './components/TwoFactorChallengeForm';

/** Landing page for the backend's OAuth redirect (see auth/oauth.controller.ts's
 * callback). Two possible outcomes, mirroring AuthService.issueTokenOrChallenge's
 * own branch: `?token=<jwt>` (no 2FA on this account — apply the session and
 * go straight in, same as before) or `?challenge=<jwt>` (2FA is enabled —
 * show the same TwoFactorChallengeForm the password-login path uses, since
 * both reach the identical backend verify flow). */
export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loginWithToken = useAuthStore((state) => state.loginWithToken);
  const verifyTwoFactor = useAuthStore((state) => state.verifyTwoFactor);
  const ran = useRef(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = searchParams.get('token');
    const challenge = searchParams.get('challenge');

    if (!token && !challenge) {
      toast.error('Sign-in failed — no token received');
      navigate(ROUTES.login, { replace: true });
      return;
    }

    // Strip whichever param out of the visible URL/history entry
    // immediately, before the async exchange below — it otherwise sits in
    // the address bar (and browser history) for the full duration of that
    // request, readable by anything with access to either.
    window.history.replaceState(null, '', window.location.pathname);

    if (challenge) {
      setChallengeToken(challenge);
      return;
    }

    loginWithToken(token!)
      .then(() => {
        toast.success('Welcome back!');
        navigate(ROUTES.chat, { replace: true });
      })
      .catch(() => {
        toast.error('Sign-in failed');
        navigate(ROUTES.login, { replace: true });
      });
  }, [searchParams, navigate, loginWithToken]);

  if (challengeToken) {
    return (
      <AuthLayout title="Verify it's you" subtitle="This account requires a two-factor code to finish signing in">
        <TwoFactorChallengeForm
          onSubmit={async (code) => {
            try {
              await verifyTwoFactor(challengeToken, code);
              toast.success('Welcome back!');
              navigate(ROUTES.chat, { replace: true });
            } catch (error) {
              toast.error(extractErrorMessage(error));
              throw error;
            }
          }}
          onBack={() => navigate(ROUTES.login, { replace: true })}
        />
      </AuthLayout>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Spinner size={32} />
    </div>
  );
}
