import { useState } from 'react';
import type { ReactElement } from 'react';
import clsx from 'clsx';
import { FiInfo, FiAlertTriangle, FiXCircle, FiLink2 } from 'react-icons/fi';
import { Card, Button } from '@/components/ui';
import { useNotificationsStore } from '@/stores/notificationsStore';
import { formatRelativeTime } from '@/utils/date';
import type { NotificationKind } from '@/services/mock/fixtures/notifications';
import styles from './NotificationsPage.module.css';

const KIND_META: Record<NotificationKind, { icon: ReactElement; color: string; bg: string }> = {
  system: { icon: <FiInfo />, color: 'var(--color-info)', bg: 'rgba(96, 165, 250, 0.14)' },
  integration: { icon: <FiLink2 />, color: 'var(--color-accent)', bg: 'var(--color-accent-muted)' },
  warning: { icon: <FiAlertTriangle />, color: 'var(--color-warning)', bg: 'rgba(251, 191, 36, 0.14)' },
  error: { icon: <FiXCircle />, color: 'var(--color-danger)', bg: 'rgba(248, 113, 113, 0.14)' },
};

const FILTERS: { id: 'all' | NotificationKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'system', label: 'System' },
  { id: 'integration', label: 'Integrations' },
  { id: 'warning', label: 'Warnings' },
  { id: 'error', label: 'Errors' },
];

export function NotificationsPage() {
  const notifications = useNotificationsStore((state) => state.notifications);
  const markRead = useNotificationsStore((state) => state.markRead);
  const markAllRead = useNotificationsStore((state) => state.markAllRead);
  const [filter, setFilter] = useState<'all' | NotificationKind>('all');

  const filtered = filter === 'all' ? notifications : notifications.filter((n) => n.kind === filter);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Notifications</div>
        <Button variant="ghost" size="sm" onClick={markAllRead}>
          Mark all as read
        </Button>
      </div>

      <div className={styles.filterRow}>
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={clsx(styles.chip, filter === f.id && styles.chipActive)} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {filtered.map((notification) => {
          const meta = KIND_META[notification.kind];
          return (
            <div key={notification.id} className={styles.item} onClick={() => markRead(notification.id)} style={{ cursor: 'pointer' }}>
              <span className={styles.iconTile} style={{ color: meta.color, background: meta.bg }}>
                {meta.icon}
              </span>
              <div className={styles.textCol}>
                <div className={styles.itemTitle}>{notification.title}</div>
                <div className={styles.itemDescription}>{notification.description}</div>
                <div className={styles.itemTime}>{formatRelativeTime(notification.timestamp)}</div>
              </div>
              {!notification.read && <span className={styles.unreadDot} />}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
