import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FiBarChart2, FiCalendar, FiCheckSquare, FiClock, FiTarget, FiZap } from 'react-icons/fi';
import { SectionCard, Skeleton } from '@/components/ui';
import { businessDashboardService } from '@/services/businessDashboardService';
import { customerActivityService } from '@/services/customerActivityService';
import { StatTile } from '@/features/dashboard/components/StatTile';
import { ROUTES } from '@/constants/routes';
import { formatINR as money } from '@/utils/currency';
import { formatStageLabel } from '@/utils/stageLabel';
import { dayjs } from '@/utils/date';
import { CustomerActivitySection } from './components/CustomerActivitySection';
import styles from './business-dashboard.module.css';

function eventTime(start: string): string {
  return start ? dayjs(start).format('h:mm A') : '';
}

export function ConsultantDashboardView() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['consultant-dashboard-overview'],
    queryFn: () => businessDashboardService.getConsultantOverview(),
    refetchInterval: 60_000,
  });
  const { data: activity } = useQuery({
    queryKey: ['customer-activity-personal-overview'],
    queryFn: () => customerActivityService.getPersonalOverview(),
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

      <SectionCard title="This Period" icon={FiBarChart2}>
        <div className={styles.statsGrid}>
          <StatTile value={money(data.personalTarget)} label="Personal Target" />
          <StatTile value={money(data.currentSales)} label="Current Sales" />
          <StatTile value={data.achievementPct === null ? '—' : `${data.achievementPct}%`} label="Achievement" />
          <StatTile value={money(data.remainingTarget)} label="Remaining Target" />
        </div>
      </SectionCard>

      <div className={styles.insightCard}>
        <span className={styles.insightLabel}>
          <FiZap size={14} /> AI Coaching
        </span>
        <span className={styles.insightText}>{data.aiCoaching}</span>
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
          onViewFull={() => navigate(ROUTES.myCustomerActivity)}
        />
      )}

      <SectionCard title="Follow-ups — Next 7 Days" icon={FiClock}>
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
      </SectionCard>

      <SectionCard title="Customer Pipeline" icon={FiTarget}>
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
      </SectionCard>

      <div className={styles.twoColumn}>
        <SectionCard title="Today's Meetings" icon={FiCalendar}>
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
        </SectionCard>
        <SectionCard title="Today's Tasks" icon={FiCheckSquare}>
          <div className={styles.emptyState}>{data.todaysTasks.message}</div>
        </SectionCard>
      </div>
    </div>
  );
}
