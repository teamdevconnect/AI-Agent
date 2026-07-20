import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiBell, FiSidebar, FiMenu } from 'react-icons/fi';
import { IconButton } from '@/components/ui';
import { useUiStore } from '@/stores/uiStore';
import { useNotificationsStore } from '@/stores/notificationsStore';
import { PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from '@/constants/navigation';
import { ROUTES } from '@/constants/routes';
import styles from './TopBar.module.css';

export interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const rightPanelOpen = useUiStore((state) => state.rightPanelOpen);
  const toggleRightPanel = useUiStore((state) => state.toggleRightPanel);
  const unreadCount = useNotificationsStore((state) => state.unreadCount());

  const title = useMemo(() => {
    if (location.pathname.startsWith(ROUTES.chat)) return 'Chat';
    if (location.pathname.startsWith(ROUTES.profile)) return 'Profile';
    const match = [...PRIMARY_NAV_ITEMS, ...SECONDARY_NAV_ITEMS].find((item) => location.pathname.startsWith(item.path));
    return match?.label ?? 'HaiVE AI';
  }, [location.pathname]);

  const isChatRoute = location.pathname.startsWith(ROUTES.chat);

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        {onMenuClick && <IconButton icon={<FiMenu />} label="Open menu" onClick={onMenuClick} />}
        <span className={styles.breadcrumb}>{title}</span>
      </div>
      <div className={styles.right}>
        <span className={styles.notificationWrapper}>
          <IconButton icon={<FiBell />} label="Notifications" onClick={() => navigate(ROUTES.notifications)} />
          {unreadCount > 0 && <span className={styles.notificationDot} />}
        </span>
        {isChatRoute && (
          <IconButton
            icon={<FiSidebar />}
            label={rightPanelOpen ? 'Hide details panel' : 'Show details panel'}
            active={rightPanelOpen}
            onClick={toggleRightPanel}
          />
        )}
      </div>
    </header>
  );
}
