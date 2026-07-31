import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FiSettings, FiBell, FiShield, FiUsers, FiUserPlus, FiTarget, FiUserCheck, FiZap } from 'react-icons/fi';
import { Tabs } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { useAuthStore } from '@/stores/authStore';
import { hasRole } from '@/utils/roles';
import styles from './SettingsLayout.module.css';

const TAB_ITEMS = [
  { id: 'general', label: 'General', icon: <FiSettings />, path: ROUTES.settingsGeneral },
  { id: 'notifications', label: 'Notifications', icon: <FiBell />, path: ROUTES.settingsNotifications },
  { id: 'security', label: 'Security', icon: <FiShield />, path: ROUTES.settingsSecurity },
  { id: 'agent-roles', label: 'AI Roles', icon: <FiUsers />, path: ROUTES.settingsAgentRoles },
  { id: 'users', label: 'Users', icon: <FiUserPlus />, path: ROUTES.settingsUsers, requireRoles: ['admin'] },
  {
    id: 'sales-targets',
    label: 'Sales Targets',
    icon: <FiTarget />,
    path: ROUTES.settingsSalesTargets,
    requireRoles: ['admin'],
  },
  {
    id: 'deal-assignment',
    label: 'Deal Assignment',
    icon: <FiUserCheck />,
    path: ROUTES.settingsDealAssignment,
    requireRoles: ['admin'],
  },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: <FiZap />,
    path: ROUTES.settingsWorkflows,
    requireRoles: ['admin'],
  },
];

export function SettingsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const visibleTabs = TAB_ITEMS.filter((t) => !t.requireRoles || t.requireRoles.some((r) => hasRole(user, r)));
  const activeId = visibleTabs.find((item) => location.pathname.startsWith(item.path))?.id ?? 'general';

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.title}>Settings</div>
        <Tabs
          orientation="vertical"
          items={visibleTabs}
          activeId={activeId}
          onChange={(id) => {
            const target = visibleTabs.find((item) => item.id === id);
            if (target) navigate(target.path);
          }}
        />
      </nav>
      <div className={styles.content}>
        <div className={styles.contentInner}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
