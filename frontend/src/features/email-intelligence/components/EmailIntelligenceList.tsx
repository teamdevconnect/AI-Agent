import { Badge, Skeleton } from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';
import type { EmailIntelligenceItem } from '@/services/emailIntelligenceService';
import styles from '../email-intelligence.module.css';

const PRIORITY_VARIANT: Record<string, BadgeVariant> = { urgent: 'danger', high: 'warning', medium: 'info', low: 'neutral' };
const SENTIMENT_VARIANT: Record<string, BadgeVariant> = { negative: 'danger', frustrated: 'danger', positive: 'success', neutral: 'neutral' };
const CONFIDENCE_VARIANT: Record<string, BadgeVariant> = { exact: 'success', domain: 'info', fuzzy: 'warning', none: 'neutral' };

function intentLabel(intent: string): string {
  return intent.replace(/_/g, ' ');
}

export function EmailIntelligenceList({
  items,
  isLoading,
  onSelect,
}: {
  items: EmailIntelligenceItem[] | undefined;
  isLoading: boolean;
  onSelect: (item: EmailIntelligenceItem) => void;
}) {
  if (isLoading || !items) return <Skeleton height={280} />;
  if (items.length === 0) return <div className={styles.emptyState}>No emails in this queue yet.</div>;

  return (
    <div className={styles.formGrid}>
      {items.map((item) => (
        <div key={item._id} className={styles.listItem} onClick={() => onSelect(item)}>
          <div className={styles.listItemMain}>
            <span className={styles.listItemTitle}>{item.subject || '(no subject)'}</span>
            <span className={styles.listItemMeta}>
              From {item.fromAddress} · {new Date(item.receivedAt).toLocaleString()}
              {item.matchedBusinessName ? ` · ${item.matchedBusinessName}` : ''}
            </span>
          </div>
          <div className={styles.badgeRow}>
            <Badge variant="accent">{intentLabel(item.intent)}</Badge>
            <Badge variant={PRIORITY_VARIANT[item.priority]}>{item.priority}</Badge>
            <Badge variant={SENTIMENT_VARIANT[item.sentiment] ?? 'neutral'}>{item.sentiment}</Badge>
            {item.matchConfidence !== 'none' && (
              <Badge variant={CONFIDENCE_VARIANT[item.matchConfidence]}>{item.matchConfidence} match</Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
