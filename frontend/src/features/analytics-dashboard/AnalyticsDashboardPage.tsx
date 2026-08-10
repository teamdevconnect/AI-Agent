import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  FiActivity,
  FiBarChart2,
  FiFileText,
  FiPieChart,
  FiTarget,
  FiTrendingUp,
  FiUsers,
  FiZap,
} from 'react-icons/fi';
import { MonthPicker, SectionCard, Skeleton, StatTile, Tabs } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { hasRole } from '@/utils/roles';
import { formatINR as money } from '@/utils/currency';
import { organizationsService } from '@/services/organizationsService';
import { analyticsDashboardService } from '@/services/analyticsDashboardService';
import { dealsService } from '@/services/dealsService';
import { quotesService } from '@/services/quotesService';
import { emailIntelligenceService } from '@/services/emailIntelligenceService';
import { WonLostTrendChart } from '../deal-performance/components/WonLostTrendChart';
import { RevenueProgressChart } from '../deal-performance/components/RevenueProgressChart';
import { DealSplitDonut } from './components/DealSplitDonut';
import { WorkBreakdownTable } from './components/WorkBreakdownTable';
import { CustomersAndEmailSection } from './components/CustomersAndEmailSection';
import { DrillDownModal, type DrillDownRow } from './components/DrillDownModal';
import styles from './analytics-dashboard.module.css';

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function periodToDateRange(period: string): { dateFrom: string; dateTo: string } {
  const [year, month] = period.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return { dateFrom: `${period}-01`, dateTo: `${period}-${String(lastDay).padStart(2, '0')}` };
}

const TAB_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'pipeline', label: 'Pipeline & Quotes' },
  { id: 'team', label: 'Team Performance' },
  { id: 'customers', label: 'Customers & Email' },
];

type DrillDownTarget =
  | { kind: 'deals'; title: string; dealStatus?: ('open' | 'won' | 'lost')[]; ownerId?: string[] }
  | { kind: 'quotes'; title: string; clientApprovalStatus?: 'approved' | 'not-approved' }
  | { kind: 'emails'; title: string; emailKind: 'sent' | 'missed' | 'intent'; intent?: string; from: string; to: string };

// Phase 19 — replaces the Owner/Manager/Consultant Home Dashboard views as
// the single /dashboard experience for every business-hierarchy role. One
// page, one endpoint (GET /analytics-dashboard/overview) — the backend
// resolves org/store/personal scope from the caller's own role/JWT, never a
// client-supplied scope beyond the owner/admin-only store override below.
export function AnalyticsDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const canOverrideStore = hasRole(user, 'owner') || hasRole(user, 'admin');

  const [period, setPeriod] = useState(currentPeriod());
  const [storeId, setStoreId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState('overview');
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [drillDown, setDrillDown] = useState<DrillDownTarget | null>(null);

  useEffect(() => {
    if (!canOverrideStore) return;
    void (async () => {
      try {
        const storeList = await organizationsService.listStores();
        setStores(storeList.map((s) => ({ id: s._id, name: s.name })));
      } catch {
        setStores([]);
      }
    })();
  }, [canOverrideStore]);

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-dashboard-overview', period, storeId],
    queryFn: () => analyticsDashboardService.getOverview(period, storeId),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });

  // Every real record shown in the drill-down modal comes from the same
  // real endpoints the rest of the app already uses (dealsService/
  // quotesService/emailIntelligenceService) — this dashboard never invents
  // or duplicates data, only surfaces it. Owner/admin's store override is
  // passed through so a filtered dashboard view drills into a matching
  // filtered list, never a wider org-wide one.
  const { data: drillItems, isLoading: drillLoading } = useQuery({
    queryKey: ['analytics-dashboard-drilldown', drillDown, period, storeId],
    queryFn: async (): Promise<DrillDownRow[]> => {
      if (!drillDown) return [];
      const { dateFrom, dateTo } = periodToDateRange(period);

      if (drillDown.kind === 'deals') {
        const result = await dealsService.listFiltered(
          {
            dateFrom,
            dateTo,
            ...(drillDown.dealStatus ? { dealStatus: drillDown.dealStatus } : {}),
            ...(drillDown.ownerId ? { ownerId: drillDown.ownerId } : {}),
            ...(canOverrideStore && storeId ? { storeId: [storeId] } : {}),
          },
          1,
          100,
        );
        return result.items.map((d) => ({
          id: d._id,
          title: d.name,
          subtitle: d.dealStatus,
          meta: d.expectedClosingDate,
          value: d.monetaryValue,
        }));
      }

      if (drillDown.kind === 'quotes') {
        const result = await quotesService.listFiltered(
          { dateFrom, dateTo, ...(drillDown.clientApprovalStatus ? { clientApprovalStatus: drillDown.clientApprovalStatus } : {}) },
          1,
          100,
        );
        return result.items.map((q) => ({
          id: q._id,
          title: q.quoteName || q.quoteNumber || 'Untitled quote',
          subtitle: q.clientDetails?.companyName,
          meta: q.clientApprovalStatus,
          value: q.quoteAmount,
        }));
      }

      const items = await emailIntelligenceService.listActivity(drillDown.emailKind, drillDown.from, drillDown.to, drillDown.intent);
      return items.map((e) => ({
        id: e._id,
        title: e.subject || '(no subject)',
        subtitle: e.fromAddress,
        meta: new Date(e.receivedAt).toLocaleDateString(),
      }));
    },
    enabled: !!drillDown,
  });

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.pageTitle}>Analytics Dashboard</div>
          <div className={styles.pageSubtitle}>
            {data ? `Showing ${data.scope.level === 'org' ? 'the whole organization' : data.scope.level === 'store' ? (data.scope.storeName ?? 'your store') : 'your own pipeline'} for ${period}` : 'Loading…'}
          </div>
        </div>
        <div className={styles.headerActions}>
          {canOverrideStore && (
            <select
              className={styles.storeSelect}
              value={storeId ?? ''}
              onChange={(e) => setStoreId(e.target.value || undefined)}
            >
              <option value="">All stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <MonthPicker value={period} onChange={setPeriod} />
        </div>
      </div>

      {isLoading || !data ? (
        <>
          <Skeleton height={100} />
          <Skeleton height={220} />
        </>
      ) : (
        <>
          <div className={styles.aiInsightCard}>
            <span className={styles.aiInsightLabel}>
              <FiZap size={14} /> AI Insight
            </span>
            <span className={styles.aiInsightText}>{data.aiInsight}</span>
          </div>

          <div className={styles.tabBar}>
            <Tabs items={TAB_ITEMS} activeId={activeTab} onChange={setActiveTab} />
          </div>

          {activeTab === 'overview' && (
            <div className={styles.tabContent}>
              <SectionCard title="Revenue & Target" icon={FiTarget}>
                <div className={styles.statsGrid}>
                  <StatTile
                    icon={FiTrendingUp}
                    value={money(data.revenue.achieved)}
                    label="Total Revenue"
                    onClick={() => setDrillDown({ kind: 'deals', title: 'Won Deals (Revenue)', dealStatus: ['won'] })}
                  />
                  <StatTile value={data.revenue.targetAmount !== null ? money(data.revenue.targetAmount) : '—'} label="Monthly Target" />
                  <StatTile value={data.revenue.achievementPct !== null ? `${data.revenue.achievementPct}%` : '—'} label="Target Achieved" />
                  <StatTile value={data.revenue.remaining !== null ? money(data.revenue.remaining) : '—'} label="Remaining" />
                  <StatTile value={money(data.revenue.predictedMonthEnd)} label="Predicted Month-End" />
                  <StatTile
                    icon={FiActivity}
                    value={data.revenue.businessHealthScore ?? '—'}
                    label="Business Health Score"
                  />
                </div>
              </SectionCard>

              <SectionCard title="Monthly Revenue vs Target" icon={FiBarChart2}>
                <RevenueProgressChart points={data.revenueTrend} />
              </SectionCard>

              <SectionCard title="Won vs Lost Revenue" icon={FiBarChart2}>
                <WonLostTrendChart
                  metric="value"
                  points={[
                    {
                      period,
                      wonCount: data.deals.wonCount,
                      wonValue: data.deals.wonValue,
                      lostCount: data.deals.lostCount,
                      lostValue: data.deals.lostValue,
                    },
                  ]}
                  onSelect={(_p, dealStatus) =>
                    setDrillDown({ kind: 'deals', title: dealStatus === 'won' ? 'Won Deals' : 'Lost Deals', dealStatus: [dealStatus] })
                  }
                />
              </SectionCard>
            </div>
          )}

          {activeTab === 'pipeline' && (
            <div className={styles.tabContent}>
              <div className={styles.twoColumn}>
                <SectionCard title="Deals: Won / Lost / Pipeline" icon={FiPieChart}>
                  <DealSplitDonut
                    totalLabel="deals this month"
                    segments={[
                      { key: 'won', label: 'Won', value: data.deals.wonCount, color: 'var(--color-success)' },
                      { key: 'lost', label: 'Lost', value: data.deals.lostCount, color: 'var(--color-danger)' },
                      { key: 'open', label: 'Pipeline', value: data.deals.openCount, color: 'var(--brand-accent-primary)' },
                    ]}
                    onSelectSegment={(key) =>
                      setDrillDown({
                        kind: 'deals',
                        title: key === 'won' ? 'Won Deals' : key === 'lost' ? 'Lost Deals' : 'Open Pipeline',
                        dealStatus: [key as 'won' | 'lost' | 'open'],
                      })
                    }
                  />
                </SectionCard>

                <SectionCard title="Quotes: Accepted / Not Accepted" icon={FiPieChart}>
                  <DealSplitDonut
                    totalLabel="quotes this month"
                    segments={[
                      { key: 'accepted', label: 'Accepted', value: data.quotes.acceptedCount, color: 'var(--color-success)' },
                      { key: 'not-accepted', label: 'Not Accepted', value: data.quotes.notAcceptedCount, color: 'var(--brand-accent-primary)' },
                    ]}
                    onSelectSegment={(key) =>
                      setDrillDown({
                        kind: 'quotes',
                        title: key === 'accepted' ? 'Accepted Quotes' : 'Quotes Not Yet Accepted',
                        clientApprovalStatus: key === 'accepted' ? 'approved' : 'not-approved',
                      })
                    }
                  />
                </SectionCard>
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className={styles.tabContent}>
              <SectionCard title="Employee Leaderboard" icon={FiUsers}>
                {data.employeeLeaderboard.length === 0 ? (
                  <div className={styles.emptyState}>No sales team members in scope for this period.</div>
                ) : (
                  data.employeeLeaderboard.map((r, i) => (
                    <div
                      key={r.userId}
                      className={styles.listItem}
                      onClick={() => setDrillDown({ kind: 'deals', title: `${r.userName}'s Won Deals`, dealStatus: ['won'], ownerId: [r.userId] })}
                    >
                      <div className={styles.listItemMain}>
                        <span className={styles.rankBadge}>{i + 1}</span>
                      </div>
                      <div className={styles.listItemMain} style={{ flex: 1 }}>
                        <span className={styles.listItemTitle}>{r.userName}</span>
                        <span className={styles.listItemMeta}>{r.wonCount} deal(s) won</span>
                      </div>
                      <strong>{money(r.revenue)}</strong>
                    </div>
                  ))
                )}
              </SectionCard>

              <SectionCard title="Sales Work Breakdown" icon={FiFileText}>
                <WorkBreakdownTable
                  rows={data.workBreakdown}
                  onSelectPerson={(userId, userName) =>
                    setDrillDown({ kind: 'deals', title: `${userName}'s Deals`, ownerId: [userId] })
                  }
                />
              </SectionCard>
            </div>
          )}

          {activeTab === 'customers' && (
            <CustomersAndEmailSection
              onSelectSummary={(kind, from, to) =>
                setDrillDown({
                  kind: 'emails',
                  title: kind === 'sent' ? 'Replied-To Business Emails' : 'Missed Business Emails (24h+)',
                  emailKind: kind,
                  from,
                  to,
                })
              }
              onSelectIntent={(intent, label, from, to) =>
                setDrillDown({ kind: 'emails', title: `${label} Emails Received`, emailKind: 'intent', intent, from, to })
              }
              onSelectIntentSent={(intent, label, from, to) =>
                setDrillDown({ kind: 'emails', title: `${label} Emails Replied To`, emailKind: 'sent', intent, from, to })
              }
            />
          )}
        </>
      )}

      <DrillDownModal
        open={!!drillDown}
        onClose={() => setDrillDown(null)}
        title={drillDown?.title ?? ''}
        isLoading={drillLoading}
        rows={drillItems ?? []}
      />
    </div>
  );
}
