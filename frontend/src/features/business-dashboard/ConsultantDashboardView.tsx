import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui';
import { businessDashboardService } from '@/services/businessDashboardService';
import { StatTile } from '@/features/dashboard/components/StatTile';
import { formatINR as money } from '@/utils/currency';
import { formatStageLabel } from '@/utils/stageLabel';
import { dayjs } from '@/utils/date';
import styles from './business-dashboard.module.css';

function eventTime(start: string): string {
  return start ? dayjs(start).format('h:mm A') : '';
}

export function ConsultantDashboardView() {
  const { data, isLoading } = useQuery({
    queryKey: ['consultant-dashboard-overview'],
    queryFn: () => businessDashboardService.getConsultantOverview(),
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className={styles.page}>
        <Skeleton height={100} />
        <Skeleton height={160} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div>
        <div className={styles.pageTitle}>My Dashboard</div>
        <div className={styles.pageSubtitle}>{data.period}</div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>This Period</span>
        <div className={styles.statsGrid}>
          <StatTile value={money(data.personalTarget)} label="Personal Target" />
          <StatTile value={money(data.currentSales)} label="Current Sales" />
          <StatTile value={data.achievementPct === null ? '—' : `${data.achievementPct}%`} label="Achievement" />
          <StatTile value={money(data.remainingTarget)} label="Remaining Target" />
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>AI Coaching</span>
        <div className={styles.insightCard}>{data.aiCoaching}</div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Follow-ups — Next 7 Days</span>
        {data.followUps.length === 0 ? (
          <div className={styles.emptyState}>No deals need follow-up in the next 7 days.</div>
        ) : (
          data.followUps.map((d) => (
            <div key={d.dealId} className={styles.listItem}>
              <div className={styles.listItemMain}>
                <span className={styles.listItemTitle}>{d.name}</span>
                <span className={styles.listItemMeta}>Expected close: {d.expectedClosingDate}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Customer Pipeline</span>
        {data.customerPipeline.length === 0 ? (
          <div className={styles.emptyState}>Your pipeline is empty.</div>
        ) : (
          data.customerPipeline.map((d) => (
            <div key={d.dealId} className={styles.listItem}>
              <div className={styles.listItemMain}>
                <span className={styles.listItemTitle}>{d.name}</span>
                <span className={styles.listItemMeta}>Stage: {d.stageId ? formatStageLabel(d.stageId) : '—'}</span>
              </div>
              <span className={styles.rankValue}>{money(d.monetaryValue)}</span>
            </div>
          ))
        )}
      </div>

      <div className={styles.twoColumn}>
        <div className={styles.section}>
          <span className={styles.sectionTitle}>Today's Meetings</span>
          {!data.todaysMeetings.available ? (
            <div className={styles.emptyState}>{data.todaysMeetings.message}</div>
          ) : data.todaysMeetings.events.length === 0 ? (
            <div className={styles.emptyState}>No meetings today.</div>
          ) : (
            data.todaysMeetings.events.map((e) => (
              <div key={e.id} className={styles.listItem}>
                <div className={styles.listItemMain}>
                  <span className={styles.listItemTitle}>{e.title || 'Untitled event'}</span>
                  <span className={styles.listItemMeta}>{eventTime(e.start)}</span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className={styles.section}>
          <span className={styles.sectionTitle}>Today's Tasks</span>
          <div className={styles.emptyState}>{data.todaysTasks.message}</div>
        </div>
      </div>
    </div>
  );
}
