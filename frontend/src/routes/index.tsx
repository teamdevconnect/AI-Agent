import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout/AuthLayout';
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute';
import { RequireRole } from './RequireRole';
import { BlockRole } from './BlockRole';
import { Spinner } from '@/components/ui';
import { ROUTES } from '@/constants/routes';

const LoginPage = lazy(() => import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() =>
  import('@/features/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
);

const DashboardRouterPage = lazy(() =>
  import('@/features/business-dashboard/DashboardRouterPage').then((m) => ({ default: m.DashboardRouterPage })),
);
const AgentWorkforceDashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const TimelinePage = lazy(() => import('@/features/timeline/TimelinePage').then((m) => ({ default: m.TimelinePage })));
const CommandCenterPage = lazy(() =>
  import('@/features/command-center/CommandCenterPage').then((m) => ({ default: m.CommandCenterPage })),
);
const DealPerformancePage = lazy(() =>
  import('@/features/deal-performance/DealPerformancePage').then((m) => ({ default: m.DealPerformancePage })),
);
const MyCustomerActivityPage = lazy(() =>
  import('@/features/deal-performance/MyCustomerActivityPage').then((m) => ({ default: m.MyCustomerActivityPage })),
);
const BusinessKnowledgePage = lazy(() =>
  import('@/features/business-knowledge/BusinessKnowledgePage').then((m) => ({ default: m.BusinessKnowledgePage })),
);
const EmailIntelligencePage = lazy(() =>
  import('@/features/email-intelligence/EmailIntelligencePage').then((m) => ({ default: m.EmailIntelligencePage })),
);
const FinancePage = lazy(() => import('@/features/finance/FinancePage').then((m) => ({ default: m.FinancePage })));
const TodoEodPage = lazy(() => import('@/features/todo-eod/TodoEodPage').then((m) => ({ default: m.TodoEodPage })));
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
const AgentRolesSettings = lazy(() =>
  import('@/features/settings/tabs/AgentRolesSettings').then((m) => ({ default: m.AgentRolesSettings })),
);
const UsersSettings = lazy(() =>
  import('@/features/settings/tabs/UsersSettings').then((m) => ({ default: m.UsersSettings })),
);
const SalesTargetsSettings = lazy(() =>
  import('@/features/settings/tabs/SalesTargetsSettings').then((m) => ({ default: m.SalesTargetsSettings })),
);
const DealAssignmentSettings = lazy(() =>
  import('@/features/settings/tabs/DealAssignmentSettings').then((m) => ({ default: m.DealAssignmentSettings })),
);
const WorkflowsSettings = lazy(() =>
  import('@/features/settings/tabs/WorkflowsSettings').then((m) => ({ default: m.WorkflowsSettings })),
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
            <Route path={ROUTES.dashboard} element={<DashboardRouterPage />} />
            <Route path={ROUTES.agentActivity} element={<AgentWorkforceDashboardPage />} />
            <Route path={ROUTES.timeline} element={<TimelinePage />} />
            <Route element={<RequireRole role="admin" />}>
              <Route path={ROUTES.commandCenter} element={<CommandCenterPage />} />
            </Route>
            <Route element={<RequireRole role={['owner', 'admin', 'manager']} />}>
              <Route path={ROUTES.dealPerformance} element={<DealPerformancePage />} />
            </Route>
            <Route element={<RequireRole role="consultant" />}>
              <Route path={ROUTES.myCustomerActivity} element={<MyCustomerActivityPage />} />
            </Route>
            <Route element={<RequireRole role={['owner', 'admin', 'manager']} />}>
              <Route path={ROUTES.businessKnowledge} element={<BusinessKnowledgePage />} />
            </Route>
            <Route element={<RequireRole role={['owner', 'admin']} />}>
              <Route path={ROUTES.finance} element={<FinancePage />} />
            </Route>
            <Route path={ROUTES.todoEod} element={<TodoEodPage />} />
            <Route path={ROUTES.chat} element={<ChatPage />} />
            <Route path={`${ROUTES.chat}/:conversationId`} element={<ChatPage />} />
            <Route path={ROUTES.notifications} element={<NotificationsPage />} />
            <Route path={ROUTES.profile} element={<ProfilePage />} />

            <Route element={<BlockRole role="agent_user" />}>
              <Route path={ROUTES.emailIntelligence} element={<EmailIntelligencePage />} />
              <Route path={ROUTES.integrations} element={<IntegrationsPage />} />
              <Route path={ROUTES.settings} element={<SettingsLayout />}>
                <Route index element={<Navigate to={ROUTES.settingsGeneral} replace />} />
                <Route path="general" element={<GeneralSettings />} />
                <Route path="notifications" element={<NotificationSettings />} />
                <Route path="security" element={<SecuritySettings />} />
                <Route path="agent-roles" element={<AgentRolesSettings />} />
                <Route element={<RequireRole role="admin" />}>
                  <Route path="users" element={<UsersSettings />} />
                  <Route path="sales-targets" element={<SalesTargetsSettings />} />
                  <Route path="deal-assignment" element={<DealAssignmentSettings />} />
                  <Route path="workflows" element={<WorkflowsSettings />} />
                </Route>
              </Route>
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
