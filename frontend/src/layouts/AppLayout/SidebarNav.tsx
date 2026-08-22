import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { NAV_GROUPS } from '@/constants/navigation';
import { hasRole } from '@/utils/roles';
import styles from './Sidebar.module.css';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const user = useAuthStore((state) => state.user);

  return (
    <nav className={styles.nav} aria-label="Primary">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => !item.hideForRoles?.some((r) => hasRole(user, r)));
        if (items.length === 0) return null;
        return (
          <div key={group.id} className={styles.navGroup}>
            {!collapsed && group.label && <div className={styles.navGroupLabel}>{group.label}</div>}
            {items.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
                className={({ isActive }) => clsx(styles.navItem, isActive && styles.navItemActive)}
              >
                <item.icon className={styles.navIcon} />
                {!collapsed && item.label}
              </NavLink>
            ))}
          </div>
        );
      })}
    </nav>
  );
}
