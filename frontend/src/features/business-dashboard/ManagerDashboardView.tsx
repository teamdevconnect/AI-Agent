import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Badge, Skeleton } from '@/components/ui';
import { businessDashboardService } from '@/services/businessDashboardService';
import { customerActivityService } from '@/services/customerActivityService';
import { StatTile } from '@/features/dashboard/components/StatTile';
import { ROUTES } from '@/constants/routes';
import { formatINR as money } from '@/utils/currency';
import { dayjs } from '@/utils/date';
import { CustomerActivitySection } from './components/CustomerActivitySection';
import styles from './business-dashboard.module.css';

function eventTime(start: string): string {
  return start ? dayjs(start).format('h:mm A') : '';
}

export function ManagerDashboardView() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['manager-dashboard-overview'],
    queryFn: () => businessDashboardService.getManagerOverview(),
    refetchInterval: 60_000,
    retry: false,
  });
  // Same endpoint Deal Performance's Customer Activity tab uses — the
  // backend already forces a manager's storeConstraint from their own JWT,
  // so this compact section and "View full →" always show the same store's
  // data as this dashboard itself.
  const { data: activity } = useQuery({
    queryKey: ['customer-activity-overview'],
    queryFn: () => customerActivityService.getOverview(),
    refetchInterval: 60_000,
  });

  if (isError) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>No store is assigned to this account yet.</div>
      </div>
    );
  }

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
        <div className={styles.pageTitle}>Store Overview</div>
        <div className={styles.pageSubtitle}>{data.period}</div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>This Period</span>
        <div className={styles.statsGrid}>
          <StatTile value={money(data.storeTarget)} label="Store Target" />
          <StatTile value={data.storeAchievement === null ? '—' : `${data.storeAchievement}%`} label="Store Achievement" />
          <StatTile value={money(data.revenue)} label="Revenue" />
          <StatTile value={data.conversionRate === null ? '—' : `${data.conversionRate}%`} label="Conversion Rate" />
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>AI Recommendation</span>
        <div className={styles.insightCard}>{data.aiRecommendation}</div>
      </div>

      {activity && (
        <CustomerActivitySection
          data={activity}
          topItemsTitle="Staleist Unactioned Items"
          topItems={[...activity.unactionedItems]
            .sort((a, b) => b.daysSinceLastUpdate - a.daysSinceLastUpdate)
            .slice(0, 3)
            .map((item) => ({
              key: `${item.type}-${item.id}`,
              title: item.businessName,
              meta: `${item.type === 'deal' ? 'Deal' : 'Quote'}: ${item.name} — ${item.daysSinceLastUpdate}d since last update`,
            }))}
          viewFullLabel="View full Customer Activity →"
          onViewFull={() => navigate(`${ROUTES.dealPerformance}?tab=customer-activity`)}
        />
      )}

      <div className={styles.section}>
        <span className={styles.sectionTitle}>
          Today's EOD Report{' '}
          <Badge variant={data.missedEodReportToday ? 'warning' : 'success'} dot>
            {data.missedEodReportToday ? 'Missed' : 'Submitted'}
          </Badge>
        </span>
      </div>

      <div className={styles.twoColumn}>
        <div className={styles.section}>
          <span className={styles.sectionTitle}>Team Performance</span>
          {data.teamPerformance.length === 0 ? (
            <div className={styles.emptyState}>No won deals recorded yet this period.</div>
          ) : (
            data.teamPerformance.map((r, i) => (
              <div key={r.userId} className={styles.rankRow}>
                <span className={styles.rankPosition}>#{i + 1}</span>
                <span className={styles.rankName}>{r.userName}</span>
                <span className={styles.rankValue}>{money(r.revenue)}</span>
              </div>
            ))
          )}
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
                <span className={styles.rankValue}>{money(d.monetaryValue)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={styles.twoColumn}>
        <div className={styles.section}>
          <span className={styles.sectionTitle}>Team Calendar — Today</span>
          {!data.teamCalendar.available ? (
            <div className={styles.emptyState}>{data.teamCalendar.message}</div>
          ) : data.teamCalendar.events.length === 0 ? (
            <div className={styles.emptyState}>No meetings today for anyone with Outlook connected.</div>
          ) : (
            data.teamCalendar.events.map((e) => (
              <div key={e.id} className={styles.listItem}>
                <div className={styles.listItemMain}>
                  <span className={styles.listItemTitle}>{e.title || 'Untitled event'}</span>
                  <span className={styles.listItemMeta}>
                    {e.userName} — {eventTime(e.start)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className={styles.section}>
          <span className={styles.sectionTitle}>Pending Tasks</span>
          <div className={styles.emptyState}>{data.pendingTasks.message}</div>
        </div>
      </div>
    </div>
  );
}
