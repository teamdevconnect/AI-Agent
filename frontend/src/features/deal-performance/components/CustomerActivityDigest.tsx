import { Badge } from '@/components/ui';
import type { CorrelatedEmail, LostWithReason, UnactionedItem } from '@/services/customerActivityService';
import { formatINR as money } from '@/utils/currency';
import styles from '../deal-performance.module.css';

const CONFIDENCE_VARIANT = { exact: 'success', domain: 'info', fuzzy: 'warning' } as const;
const CONFIDENCE_LABEL = { exact: 'Confirmed match', domain: 'Domain match', fuzzy: 'Possible match' } as const;

export function UnactionedList({ items }: { items: UnactionedItem[] }) {
  if (items.length === 0) return <div className={styles.emptyState}>Nothing left unactioned — everything open has moved today.</div>;
  return (
    <>
      {items.map((item) => (
        <div key={`${item.type}-${item.id}`} className={styles.listItem}>
          <div className={styles.listItemMain}>
            <span className={styles.listItemTitle}>{item.businessName}</span>
            <span className={styles.listItemMeta}>
              {item.type === 'deal' ? 'Deal' : 'Quote'}: {item.name}
            </span>
          </div>
          <Badge variant={item.daysSinceLastUpdate > 14 ? 'danger' : 'warning'}>
            {item.daysSinceLastUpdate === 0 ? 'Not touched today' : `${item.daysSinceLastUpdate}d since last update`}
          </Badge>
        </div>
      ))}
    </>
  );
}

export function LostReasonList({ items }: { items: LostWithReason[] }) {
  if (items.length === 0) return <div className={styles.emptyState}>No lost deals in scope.</div>;
  return (
    <>
      {items.map((item) => (
        <div key={item.dealId} className={styles.listItem}>
          <div className={styles.listItemMain}>
            <span className={styles.listItemTitle}>{item.businessName}</span>
            <span className={styles.listItemMeta}>
              {item.name} — {money(item.monetaryValue)}
            </span>
          </div>
          {item.lostReason ? (
            <Badge variant={item.lostReasonSource === 'ai_inferred' ? 'info' : 'neutral'}>
              {item.lostReason}
              {item.lostReasonSource === 'ai_inferred' ? ' (AI-inferred)' : ''}
            </Badge>
          ) : (
            <Badge variant="warning">No reason recorded</Badge>
          )}
        </div>
      ))}
    </>
  );
}

export function CorrelatedEmailList({ items }: { items: CorrelatedEmail[] }) {
  if (items.length === 0) {
    return <div className={styles.emptyState}>No today's emails correlated to a customer yet.</div>;
  }
  return (
    <>
      {items.map((email) => (
        <div key={email.id} className={styles.listItem}>
          <div className={styles.listItemMain}>
            <span className={styles.listItemTitle}>{email.subject || '(no subject)'}</span>
            <span className={styles.listItemMeta}>
              {email.from} → {email.matchedBusinessName} {!email.isRead && '· Unread'}
              {email.importance === 'high' && ' · High importance'}
            </span>
          </div>
          <Badge variant={CONFIDENCE_VARIANT[email.matchConfidence]}>{CONFIDENCE_LABEL[email.matchConfidence]}</Badge>
        </div>
      ))}
    </>
  );
}
