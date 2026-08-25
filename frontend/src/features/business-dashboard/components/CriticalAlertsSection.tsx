import { useNavigate } from 'react-router-dom';
import { FiAlertTriangle } from 'react-icons/fi';
import { Badge, Button, SectionCard } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import type { CriticalAlertGroup, CriticalAlertKey } from '@/services/homeDashboardService';
import styles from '../business-dashboard.module.css';

// Route mapping lives on the frontend, not the backend — same separation
// every other rule-based insight in this app already keeps (plain text out
// of the backend, routing decisions stay client-side).
const VIEW_ALL_ROUTE: Partial<Record<CriticalAlertKey, string>> = {
  deals_at_risk: `${ROUTES.dealPerformance}?tab=customer-activity`,
  overdue_tasks: ROUTES.todoEod,
  urgent_emails: ROUTES.emailIntelligence,
};

// Tier 2 — one group per alert type, each capped at 5 itemized rows with a
// "View all" link when a real drill-down destination exists (missed_eod has
// none yet — no dedicated per-store EOD-status page has been built).
export function CriticalAlertsSection({ groups }: { groups: CriticalAlertGroup[] }) {
  const navigate = useNavigate();

  if (groups.length === 0) {
    return (
      <SectionCard title="Critical Alerts" icon={FiAlertTriangle}>
        <div className={styles.emptyState}>Nothing needs urgent attention right now.</div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Critical Alerts" icon={FiAlertTriangle}>
      <div className={styles.stackList}>
        {groups.map((group) => {
          const route = VIEW_ALL_ROUTE[group.key];
          return (
            <div key={group.key} className={styles.stackList}>
              <div className={styles.alertGroupHeader}>
                <span className={styles.alertGroupLabel}>
                  {group.label} <Badge variant="danger">{group.count}</Badge>
                </span>
                {route && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => navigate(route)}>
                    View all →
                  </Button>
                )}
              </div>
              {group.items.map((item) => (
                <div key={item.id} className={styles.listItem}>
                  <div className={styles.listItemMain}>
                    <span className={styles.listItemTitle}>{item.title}</span>
                    <span className={styles.listItemMeta}>{item.meta}</span>
                  </div>
                  {item.valueLabel && <span className={styles.rankValue}>{item.valueLabel}</span>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
