import { useQuery } from '@tanstack/react-query';
import { Badge, Skeleton } from '@/components/ui';
import { commandCenterService } from '@/services/commandCenterService';
import { StatTile } from '@/features/dashboard/components/StatTile';
import { CostTrendChart } from './components/CostTrendChart';
import { dayjs } from '@/utils/date';
import styles from './command-center.module.css';

function money(value: number): string {
  return `$${value.toFixed(4)}`;
}

export function CommandCenterPage() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['command-center-summary'],
    queryFn: () => commandCenterService.getSummary(7),
    refetchInterval: 60_000,
  });

  const { data: executions, isLoading: executionsLoading } = useQuery({
    queryKey: ['command-center-executions'],
    queryFn: () => commandCenterService.listExecutions({ limit: 50 }),
    refetchInterval: 60_000,
  });

  if (summaryLoading || !summary) {
    return (
      <div className={styles.page}>
        <Skeleton height={100} />
        <Skeleton height={200} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div>
        <div className={styles.pageTitle}>AI Command Center</div>
        <div className={styles.pageSubtitle}>Last {summary.days} days — every AI agent call, in one place</div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Usage Summary</span>
        <div className={styles.statsGrid}>
          <StatTile value={summary.totalCalls} label="Total Calls" />
          <StatTile value={money(summary.totalCost)} label="Est. Cost" />
          <StatTile value={summary.totalInputTokens.toLocaleString()} label="Input Tokens" />
          <StatTile value={summary.totalOutputTokens.toLocaleString()} label="Output Tokens" />
          <StatTile value={`${summary.errorRatePct}%`} label="Error Rate" />
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Cost Over Time</span>
        <CostTrendChart points={summary.costTrend} />
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>By Provider</span>
        {summary.byProvider.length === 0 ? (
          <div className={styles.emptyState}>No LLM calls recorded yet.</div>
        ) : (
          summary.byProvider.map((p) => (
            <div key={p.provider} className={styles.rankRow}>
              <span className={styles.rankName}>{p.provider}</span>
              <span className={styles.rankValue}>{p.count} calls</span>
              <span className={styles.rankValue}>{money(p.cost)}</span>
            </div>
          ))
        )}
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Recent Executions</span>
        {executionsLoading || !executions ? (
          <Skeleton height={160} />
        ) : executions.length === 0 ? (
          <div className={styles.emptyState}>No executions recorded yet.</div>
        ) : (
          executions.map((e) => (
            <div key={e._id} className={styles.listItem}>
              <div className={styles.listItemMain}>
                <span className={styles.listItemTitle}>
                  {e.name} {e.provider ? `(${e.provider}${e.model ? ` — ${e.model}` : ''})` : `(${e.kind})`}
                </span>
                <span className={styles.listItemMeta}>
                  {dayjs(e.occurredAt).format('MMM D, h:mm:ss A')} — {Math.round(e.latencyMs)}ms
                  {e.kind === 'llm' && typeof e.costUsd === 'number' ? ` — ${money(e.costUsd)}` : ''}
                  {e.error ? ` — ${e.error}` : ''}
                </span>
              </div>
              <Badge variant={e.success ? 'success' : 'danger'}>{e.success ? 'OK' : 'Error'}</Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
