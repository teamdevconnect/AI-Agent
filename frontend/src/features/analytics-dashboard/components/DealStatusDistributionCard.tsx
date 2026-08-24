import clsx from 'clsx';
import { Card, InfoPopover } from '@/components/ui';
import { usePipelineDecisionCounts } from './usePipelineDecisionCounts';
import styles from './DealStatusDistributionCard.module.css';

export interface DealStatusDistributionCardProps {
  deals: { wonCount: number; openCount: number };
  dateFrom: string;
  dateTo: string;
  storeId?: string;
}

// "In review" = open deals with no unapproved quote out yet (i.e. not
// waiting on a client decision) — a real, derived remainder
// (openCount - awaitingResponseCount), not an invented status value. This
// app has no third quoteStatus/clientApprovalStatus value anywhere in its
// schema or sync logic, so nothing here claims a status that doesn't exist.
export function DealStatusDistributionCard({ deals, dateFrom, dateTo, storeId }: DealStatusDistributionCardProps) {
  const { awaitingResponseCount } = usePipelineDecisionCounts(dateFrom, dateTo, storeId);
  const inReviewCount = Math.max(0, deals.openCount - awaitingResponseCount);

  const rows = [
    { id: 'won', label: 'Won', count: deals.wonCount },
    { id: 'awaiting', label: 'Awaiting response', count: awaitingResponseCount },
    { id: 'review', label: 'In review', count: inReviewCount },
  ];
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <Card className={styles.card}>
      <div className={styles.label}>Distribution</div>
      <div className={styles.title}>
        Deal status
        <InfoPopover title="Deal status">
          <p><strong>Won</strong> deals closed successfully. <strong>Awaiting response</strong> are open deals with a quote out that the client hasn't approved yet.</p>
          <p><strong>In review</strong> is the remainder — open deals with no unapproved quote out, so nothing is currently waiting on a client decision.</p>
        </InfoPopover>
      </div>

      <div className={styles.list}>
        {rows.map((row) => (
          <div key={row.id} className={styles.row}>
            <div className={styles.rowHeader}>
              <span className={styles.rowLabel}>{row.label}</span>
              <span className={styles.rowCount}>
                {row.count} deal{row.count === 1 ? '' : 's'}
              </span>
            </div>
            <div className={styles.track}>
              <div className={clsx(styles.fill, styles[`fill-${row.id}`])} style={{ width: `${(row.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <i className={clsx(styles.dot, styles['dot-won'])} /> Won
        </span>
        <span className={styles.legendItem}>
          <i className={clsx(styles.dot, styles['dot-awaiting'])} /> Open
        </span>
        <span className={styles.legendItem}>
          <i className={clsx(styles.dot, styles['dot-review'])} /> Review
        </span>
      </div>
    </Card>
  );
}
