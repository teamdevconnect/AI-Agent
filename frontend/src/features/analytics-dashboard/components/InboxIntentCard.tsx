import { Card, InfoPopover } from '@/components/ui';
import styles from './InboxIntentCard.module.css';

export interface InboxIntentCardProps {
  byIntent: { intent: string; label: string; receivedCount: number }[];
}

export function InboxIntentCard({ byIntent }: InboxIntentCardProps) {
  const max = Math.max(1, ...byIntent.map((i) => i.receivedCount));

  return (
    <Card className={styles.card}>
      <div className={styles.label}>Inbox Intelligence</div>
      <div className={styles.title}>
        By intent
        <InfoPopover title="By intent">
          <p>Relevant inbound emails in this period, grouped by the intent the AI classified each one with (e.g. new enquiry, quotation request, complaint, price negotiation).</p>
          <p>Only intents a salesperson would act on are shown — internal mail, spam, and other noise are filtered out.</p>
        </InfoPopover>
      </div>

      {byIntent.length === 0 ? (
        <div className={styles.empty}>No relevant emails in this period.</div>
      ) : (
        <div className={styles.list}>
          {byIntent.map((row) => (
            <div key={row.intent} className={styles.row}>
              <div className={styles.rowHeader}>
                <span className={styles.rowLabel}>{row.label}</span>
                <span className={styles.rowValue}>{row.receivedCount}</span>
              </div>
              <div className={styles.track}>
                <div className={styles.fill} style={{ width: `${(row.receivedCount / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
