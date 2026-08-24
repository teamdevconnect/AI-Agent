import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FiAward, FiBarChart2, FiTrendingUp, FiUsers } from 'react-icons/fi';
import { Badge, Button, SectionCard, Skeleton, StatTile } from '@/components/ui';
import { businessDashboardService } from '@/services/businessDashboardService';
import { customerActivityService } from '@/services/customerActivityService';
import { homeDashboardService } from '@/services/homeDashboardService';
import { ROUTES } from '@/constants/routes';
import { formatINR as money } from '@/utils/currency';
import { RevenueTrendChart } from './components/RevenueTrendChart';
import { CustomerActivitySection } from './components/CustomerActivitySection';
import { AiRecommendationsSection } from './components/AiRecommendationsSection';
import { CriticalAlertsSection } from './components/CriticalAlertsSection';
import { TodaysTasksSection } from './components/TodaysTasksSection';
import { EmailSummarySection } from './components/EmailSummarySection';
import { TimelineSection } from './components/TimelineSection';
import { HistoricalActivityFooter } from './components/HistoricalActivityFooter';
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
  const { data: home } = useQuery({
    queryKey: ['home-dashboard-owner'],
    queryFn: () => homeDashboardService.getOwnerHome(),
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

      {/* Tier 1 */}
      {home ? <AiRecommendationsSection items={home.aiRecommendations} /> : <Skeleton height={100} />}

      {/* Tier 2 */}
      {home && <CriticalAlertsSection groups={home.criticalAlerts} />}

      {/* Tier 3 */}
      <TodaysTasksSection
        calendarEvents={data.todaysMeetings.available ? data.todaysMeetings.events : undefined}
        calendarMessage={data.todaysMeetings.available ? undefined : data.todaysMeetings.message}
      />

      {/* Tier 4 */}
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
          extraStats={[{ value: data.riskAlerts.length, label: 'Deals at Risk' }]}
        />
      )}

      {/* Tier 5 */}
      {home && <EmailSummarySection summary={home.emailSummary} />}

      {/* Tier 6 — Sales Performance (existing, repositioned) */}
      <SectionCard title="This Period" icon={FiBarChart2}>
        <div className={styles.statsGrid}>
          <StatTile value={money(data.totalRevenue)} label="Total Revenue" />
          <StatTile value={money(data.monthlyTarget)} label="Monthly Target" />
          <StatTile value={data.achievementPct === null ? '—' : `${data.achievementPct}%`} label="Achievement" />
          <StatTile value={money(data.remaining)} label="Remaining Target" />
          <StatTile value={money(data.forecast.predictedMonthEnd)} label="Predicted Month-End" />
          <StatTile value={data.businessHealthScore} label="Business Health Score" />
        </div>
      </SectionCard>

      <SectionCard title="Revenue Trend — Last 6 Months" icon={FiTrendingUp}>
        <RevenueTrendChart points={data.revenueTrend} />
      </SectionCard>

      <SectionCard title="Store Rankings" icon={FiAward}>
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
      </SectionCard>

      <SectionCard title="Employee Activity Monitor" icon={FiUsers}>
        {data.employeeLeaderboard.length === 0 ? (
          <div className={styles.emptyState}>No employees to show yet this period.</div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.activityTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Employee</th>
                  <th>Revenue</th>
                  <th>Won Deals</th>
                  <th>Emails Sent</th>
                  <th>Emails Missed</th>
                </tr>
              </thead>
              <tbody>
                {data.employeeLeaderboard.map((r, i) => (
                  <tr key={r.userId}>
                    <td>{i + 1}</td>
                    <td>{r.userName}</td>
                    <td>{money(r.revenue)}</td>
                    <td>{r.wonCount}</td>
                    <td>{r.emailsSent}</td>
                    <td>
                      {r.emailsMissed > 0 ? <Badge variant="danger">{r.emailsMissed}</Badge> : r.emailsMissed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Tier 7 */}
      {home && <TimelineSection events={home.timeline} />}

      {/* Tier 8 */}
      <HistoricalActivityFooter />
    </div>
  );
}
