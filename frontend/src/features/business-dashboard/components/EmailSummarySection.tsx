import { useNavigate } from 'react-router-dom';
import { FiMail } from 'react-icons/fi';
import { Button, SectionCard } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { formatFullDate } from '@/utils/date';
import type { TodaysEmailSummary } from '@/services/homeDashboardService';
import styles from '../business-dashboard.module.css';

// Tier 5 — deliberately self-scoped to the caller's OWN connected mailbox
// only (Email Intelligence has no org-wide oversight view — a Phase 14b
// decision, not reopened here). An Owner/Manager with no personally
// connected Outlook account honestly sees the empty state below, never a
// fake team-wide rollup.
export function EmailSummarySection({ summary }: { summary: TodaysEmailSummary }) {
  const navigate = useNavigate();

  return (
    <SectionCard
      title="Email Summary"
      icon={FiMail}
      action={
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate(ROUTES.emailIntelligence)}>
          View full Inbox →
        </Button>
      }
    >
      {!summary.connected ? (
        <div className={styles.emptyState}>
          Connect Outlook in Integrations to see your pending emails here.
        </div>
      ) : summary.pendingCount === 0 ? (
        <div className={styles.emptyState}>No pending emails right now.</div>
      ) : (
        <div className={styles.stackList}>
          <div className={styles.emailBucketRow}>
            {summary.byIntentBucket.map((b) => (
              <span key={b.bucket} className={styles.emailBucketChip}>
                {b.bucket}: {b.count}
              </span>
            ))}
          </div>
          {summary.topItems.map((item) => (
            <div key={item.id} className={styles.listItem}>
              <div className={styles.listItemMain}>
                <span className={styles.listItemTitle}>{item.subject}</span>
                <span className={styles.listItemMeta}>
                  From {item.from} · {formatFullDate(item.receivedAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
