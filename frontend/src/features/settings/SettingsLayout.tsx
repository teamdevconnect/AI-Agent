import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FiSettings, FiBell, FiShield } from 'react-icons/fi';
import { Tabs } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import styles from './SettingsLayout.module.css';

const TAB_ITEMS = [
  { id: 'general', label: 'General', icon: <FiSettings />, path: ROUTES.settingsGeneral },
  { id: 'notifications', label: 'Notifications', icon: <FiBell />, path: ROUTES.settingsNotifications },
  { id: 'security', label: 'Security', icon: <FiShield />, path: ROUTES.settingsSecurity },
];

export function SettingsLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeId = TAB_ITEMS.find((item) => location.pathname.startsWith(item.path))?.id ?? 'general';

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.title}>Settings</div>
        <Tabs
          orientation="vertical"
          items={TAB_ITEMS}
          activeId={activeId}
          onChange={(id) => {
            const target = TAB_ITEMS.find((item) => item.id === id);
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
