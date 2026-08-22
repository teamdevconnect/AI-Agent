import { Card } from '@/components/ui';
import { usePipelineDecisionCounts } from './usePipelineDecisionCounts';
import styles from './DealFunnelCard.module.css';

export interface DealFunnelCardProps {
  deals: { wonCount: number; lostCount: number; openCount: number };
  dateFrom: string;
  dateTo: string;
  storeId?: string;
}

// A real 4-step funnel, not the generic "Qualified"/"Proposal Sent"-style
// stage names a CRM template might show — this app has no stage-name data
// at all (Deal.stageId is an opaque external-CRM id with no label anywhere
// in the system, confirmed against both schema and sync code). Every step
// here is instead a real, always-populated bucket: total deals, still-open,
// open-with-an-unapproved-quote, and won.
export function DealFunnelCard({ deals, dateFrom, dateTo, storeId }: DealFunnelCardProps) {
  const { awaitingResponseCount } = usePipelineDecisionCounts(dateFrom, dateTo, storeId);
  const totalDeals = deals.wonCount + deals.lostCount + deals.openCount;

  const stages = [
    { label: 'All opportunities', count: totalDeals },
    { label: 'Open', count: deals.openCount },
    { label: 'Awaiting response', count: awaitingResponseCount },
    { label: 'Won', count: deals.wonCount },
  ];
  const max = Math.max(1, totalDeals);

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className={styles.label}>Conversion View</div>
          <div className={styles.title}>Deal movement</div>
        </div>
        <span className={styles.period}>This period</span>
      </div>

      <div className={styles.funnel}>
        {stages.map((stage, i) => (
          <div
            key={stage.label}
            className={styles.bar}
            style={{ width: `${Math.max(12, (stage.count / max) * 100)}%`, background: `color-mix(in srgb, var(--brand-accent-primary) ${30 + i * 22}%, var(--color-accent-muted))` }}
          >
            <span className={styles.barLabel}>{stage.label}</span>
            <span className={styles.barCount}>{stage.count}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
