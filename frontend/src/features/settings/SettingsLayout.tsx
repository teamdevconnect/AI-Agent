import { Outlet, useLocation, useNavigate } from 'react-router-dom';
<<<<<<< HEAD
import { FiSettings, FiBell, FiShield } from 'react-icons/fi';
import { Tabs } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
=======
import { FiSettings, FiBell, FiShield, FiUsers, FiUserPlus } from 'react-icons/fi';
import { Tabs } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { useAuthStore } from '@/stores/authStore';
import { hasRole } from '@/utils/roles';
>>>>>>> 6a60a8648 (Initial AI Agent source code)
import styles from './SettingsLayout.module.css';

const TAB_ITEMS = [
  { id: 'general', label: 'General', icon: <FiSettings />, path: ROUTES.settingsGeneral },
  { id: 'notifications', label: 'Notifications', icon: <FiBell />, path: ROUTES.settingsNotifications },
  { id: 'security', label: 'Security', icon: <FiShield />, path: ROUTES.settingsSecurity },
<<<<<<< HEAD
=======
  { id: 'agent-roles', label: 'AI Roles', icon: <FiUsers />, path: ROUTES.settingsAgentRoles },
  { id: 'users', label: 'Users', icon: <FiUserPlus />, path: ROUTES.settingsUsers, requireRoles: ['admin'] },
>>>>>>> 6a60a8648 (Initial AI Agent source code)
];

export function SettingsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
<<<<<<< HEAD

  const activeId = TAB_ITEMS.find((item) => location.pathname.startsWith(item.path))?.id ?? 'general';
=======
  const user = useAuthStore((state) => state.user);

  const visibleTabs = TAB_ITEMS.filter((t) => !t.requireRoles || t.requireRoles.some((r) => hasRole(user, r)));
  const activeId = visibleTabs.find((item) => location.pathname.startsWith(item.path))?.id ?? 'general';
>>>>>>> 6a60a8648 (Initial AI Agent source code)

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.title}>Settings</div>
        <Tabs
          orientation="vertical"
<<<<<<< HEAD
          items={TAB_ITEMS}
          activeId={activeId}
          onChange={(id) => {
            const target = TAB_ITEMS.find((item) => item.id === id);
=======
          items={visibleTabs}
          activeId={activeId}
          onChange={(id) => {
            const target = visibleTabs.find((item) => item.id === id);
>>>>>>> 6a60a8648 (Initial AI Agent source code)
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
