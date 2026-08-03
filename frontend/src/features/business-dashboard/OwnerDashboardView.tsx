import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button, Skeleton } from '@/components/ui';
import { businessDashboardService } from '@/services/businessDashboardService';
import { customerActivityService } from '@/services/customerActivityService';
import { StatTile } from '@/features/dashboard/components/StatTile';
import { ROUTES } from '@/constants/routes';
import { formatINR as money } from '@/utils/currency';
import { RevenueTrendChart } from './components/RevenueTrendChart';
import { CustomerActivitySection } from './components/CustomerActivitySection';
import styles from './business-dashboard.module.css';

export function OwnerDashboardView() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['owner-dashboard-overview'],
    queryFn: () => businessDashboardService.getOwnerOverview(),
    refetchInterval: 60_000,
  });
  const { data: activity } = useQuery({
    queryKey: ['customer-activity-overview'],
    queryFn: () => customerActivityService.getOverview(),
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className={styles.page}>
        <Skeleton height={100} />
        <Skeleton height={220} />
        <Skeleton height={160} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.pageTitle}>Business Overview</div>
          <div className={styles.pageSubtitle}>{data.period}</div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate(ROUTES.settingsSalesTargets)}>
          Set Sales Targets
        </Button>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>This Period</span>
        <div className={styles.statsGrid}>
          <StatTile value={money(data.totalRevenue)} label="Total Revenue" />
          <StatTile value={money(data.monthlyTarget)} label="Monthly Target" />
          <StatTile value={data.achievementPct === null ? '—' : `${data.achievementPct}%`} label="Achievement" />
          <StatTile value={money(data.remaining)} label="Remaining Target" />
          <StatTile value={money(data.forecast.predictedMonthEnd)} label="Predicted Month-End" />
          <StatTile value={data.businessHealthScore} label="Business Health Score" />
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>AI Insight</span>
        <div className={styles.insightCard}>{data.aiInsight}</div>
      </div>

      {activity && (
        <CustomerActivitySection
          data={activity}
          topItemsTitle="Highest-Value Lost Deals"
          topItems={[...activity.lostWithReason]
            .sort((a, b) => b.monetaryValue - a.monetaryValue)
            .slice(0, 3)
            .map((d) => ({
              key: d.dealId,
              title: d.businessName,
              meta: d.lostReason ?? 'No reason recorded',
              valueLabel: money(d.monetaryValue),
            }))}
          viewFullLabel="View full Customer Activity →"
          onViewFull={() => navigate(`${ROUTES.dealPerformance}?tab=customer-activity`)}
        />
      )}

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Revenue Trend — Last 6 Months</span>
        <RevenueTrendChart points={data.revenueTrend} />
      </div>

      <div className={styles.twoColumn}>
        <div className={styles.section}>
          <span className={styles.sectionTitle}>Store Rankings</span>
          {data.storeRankings.length === 0 ? (
            <div className={styles.emptyState}>No store revenue recorded yet this period.</div>
          ) : (
            data.storeRankings.map((r, i) => (
              <div key={r.storeId} className={styles.rankRow}>
                <span className={styles.rankPosition}>#{i + 1}</span>
                <span className={styles.rankName}>{r.storeName}</span>
                <span className={styles.rankValue}>{money(r.revenue)}</span>
              </div>
            ))
          )}
        </div>

        <div className={styles.section}>
          <span className={styles.sectionTitle}>Employee Leaderboard</span>
          {data.employeeLeaderboard.length === 0 ? (
            <div className={styles.emptyState}>No won deals recorded yet this period.</div>
          ) : (
            data.employeeLeaderboard.map((r, i) => (
              <div key={r.userId} className={styles.rankRow}>
                <span className={styles.rankPosition}>#{i + 1}</span>
                <span className={styles.rankName}>{r.userName}</span>
                <span className={styles.rankValue}>{money(r.revenue)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Risk Alerts — Deals Past Expected Close</span>
        {data.riskAlerts.length === 0 ? (
          <div className={styles.emptyState}>No open deals are past their expected close date.</div>
        ) : (
          data.riskAlerts.map((d) => (
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
  );
}
