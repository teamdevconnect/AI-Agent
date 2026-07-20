import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout/AuthLayout';
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute';
import { Spinner } from '@/components/ui';
import { ROUTES } from '@/constants/routes';

const LoginPage = lazy(() => import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() =>
  import('@/features/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
);

const ChatPage = lazy(() => import('@/features/chat/ChatPage').then((m) => ({ default: m.ChatPage })));
const IntegrationsPage = lazy(() =>
  import('@/features/integrations/IntegrationsPage').then((m) => ({ default: m.IntegrationsPage })),
);
const NotificationsPage = lazy(() =>
  import('@/features/notifications/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })));

const SettingsLayout = lazy(() => import('@/features/settings/SettingsLayout').then((m) => ({ default: m.SettingsLayout })));
const GeneralSettings = lazy(() =>
  import('@/features/settings/tabs/GeneralSettings').then((m) => ({ default: m.GeneralSettings })),
);
const NotificationSettings = lazy(() =>
  import('@/features/settings/tabs/NotificationSettings').then((m) => ({ default: m.NotificationSettings })),
);
const SecuritySettings = lazy(() =>
  import('@/features/settings/tabs/SecuritySettings').then((m) => ({ default: m.SecuritySettings })),
);

const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

function PageFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 240 }}>
      <Spinner size={28} />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route
            path={ROUTES.login}
            element={
              <AuthLayout title="Welcome back" subtitle="Sign in to your enterprise AI workspace">
                <LoginPage />
              </AuthLayout>
            }
          />
          <Route
            path={ROUTES.register}
            element={
              <AuthLayout title="Create your workspace" subtitle="Set up your enterprise AI account">
                <RegisterPage />
              </AuthLayout>
            }
          />
          <Route
            path={ROUTES.forgotPassword}
            element={
              <AuthLayout title="Reset your password" subtitle="We'll send a verification code to your email">
                <ForgotPasswordPage />
              </AuthLayout>
            }
          />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to={ROUTES.chat} replace />} />
            <Route path={ROUTES.chat} element={<ChatPage />} />
            <Route path={`${ROUTES.chat}/:conversationId`} element={<ChatPage />} />
            <Route path={ROUTES.integrations} element={<IntegrationsPage />} />
            <Route path={ROUTES.notifications} element={<NotificationsPage />} />
            <Route path={ROUTES.profile} element={<ProfilePage />} />

            <Route path={ROUTES.settings} element={<SettingsLayout />}>
              <Route index element={<Navigate to={ROUTES.settingsGeneral} replace />} />
              <Route path="general" element={<GeneralSettings />} />
              <Route path="notifications" element={<NotificationSettings />} />
              <Route path="security" element={<SecuritySettings />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
