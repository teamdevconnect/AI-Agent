import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FiActivity, FiBarChart2, FiPieChart, FiTarget, FiTrendingUp, FiUsers, FiZap } from 'react-icons/fi';
import { MonthYearFilterPopup, SectionCard, Skeleton, StatTile, Tabs } from '@/components/ui';
import type { DateRange } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { hasRole } from '@/utils/roles';
import { formatINR as money } from '@/utils/currency';
import { organizationsService } from '@/services/organizationsService';
import { analyticsDashboardService } from '@/services/analyticsDashboardService';
import { dealsService } from '@/services/dealsService';
import { quotesService } from '@/services/quotesService';
import { WonLostTrendChart } from '../deal-performance/components/WonLostTrendChart';
import { RevenueProgressChart } from '../deal-performance/components/RevenueProgressChart';
import { DealSplitDonut } from './components/DealSplitDonut';
import { CustomersAndEmailSection } from './components/CustomersAndEmailSection';
import { DrillDownModal, type DrillDownRow } from './components/DrillDownModal';
import { ProductivitySection } from './components/ProductivitySection';
import { EnquiryConversionSection } from './components/EnquiryConversionSection';
import { VendorProfitabilitySection } from './components/VendorProfitabilitySection';
import { AiFollowupSummarySection } from './components/AiFollowupSummarySection';
import { QuotesPaymentsSection } from './components/QuotesPaymentsSection';
import styles from './analytics-dashboard.module.css';

// Local-calendar-date formatter — deliberately NOT `.toISOString().slice(0,10)`,
// which converts to UTC first: a Date constructed at LOCAL midnight on the
// 1st of the month lands on the 31st of the PREVIOUS month once read back in
// UTC for any timezone ahead of UTC (e.g. IST, UTC+5:30), silently corrupting
// the "current month" default into a two-month-spanning range. Real bug,
// confirmed live (dashboard defaulted to "Jul 31 – Aug 14" and the month
// picker showed "July" while today was in August). Reading the same
// getFullYear/getMonth/getDate the Date was built from guarantees no drift
// regardless of the browser's timezone.
function fmtLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Defaults to the current month (start of month through today), never "all
// time" — matches MonthYearFilterPopup's own current-month rendering, so the
// popup's initial label/selection is correct without any extra sync logic.
function defaultRange(): DateRange {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return { dateFrom: fmtLocalDate(startOfMonth), dateTo: fmtLocalDate(now) };
}

// Consolidated (see each tab's own comment for what folded in where) — down
// from 10 tabs to 6. Every BI section still exists and fetches the exact
// same real endpoints; only the navigation surface changed, driven by a
// direct "too many tabs, too much redundancy" correction. Sent/Missed Email
// Analytics folded into Customers & Email (that tab already showed the same
// summary numbers, just a thinner version); Employee Productivity folded
// into Team Performance (a strict superset of the old Won/Lost/Open table);
// Enquiry Conversion and Quotes & Payments folded into Pipeline & Quotes
// (all three are "what happened to this quote" questions). Vendor
// Profitability and AI Follow-Ups stay as their own tabs — genuinely
// different sensitivity tier / interaction pattern, not redundant with
// anything else here.
const TAB_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'pipeline', label: 'Pipeline & Quotes' },
  { id: 'team', label: 'Team Performance' },
  { id: 'customers', label: 'Customers & Email' },
  // Owner/admin only — matches vendor-profitability.controller.ts's own
  // tighter RBAC tier (margin data is more sensitive than pipeline data).
  { id: 'bi-vendor', label: 'Vendor Profitability', requireRoles: ['owner', 'admin'] },
  { id: 'bi-followups', label: 'AI Follow-Ups' },
];

type DrillDownTarget =
  | {
      kind: 'deals';
      title: string;
      dealStatus?: ('open' | 'won' | 'lost')[];
      ownerId?: string[];
      dateField?: 'createdAt' | 'expectedClosingDate';
    }
  | { kind: 'quotes'; title: string; clientApprovalStatus?: 'approved' | 'not-approved' };

// Phase 19 — replaces the Owner/Manager/Consultant Home Dashboard views as
// the single /dashboard experience for every business-hierarchy role. One
// page, one endpoint (GET /analytics-dashboard/overview) — the backend
// resolves org/store/personal scope from the caller's own role/JWT, never a
// client-supplied scope beyond the owner/admin-only store override below.
export function AnalyticsDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const canOverrideStore = hasRole(user, 'owner') || hasRole(user, 'admin');

  const [range, setRange] = useState<DateRange>(defaultRange());
  const [storeId, setStoreId] = useState<string | undefined>(undefined);
  const dateFrom = range.dateFrom ?? defaultRange().dateFrom!;
  const dateTo = range.dateTo ?? defaultRange().dateTo!;
  const [activeTab, setActiveTab] = useState('overview');
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [drillDown, setDrillDown] = useState<DrillDownTarget | null>(null);

  const visibleTabs = TAB_ITEMS.filter((t) => !t.requireRoles || t.requireRoles.some((r) => hasRole(user, r)));

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
    queryKey: ['analytics-dashboard-overview', dateFrom, dateTo, storeId],
    queryFn: () => analyticsDashboardService.getOverview(dateFrom, dateTo, storeId),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });

  // Every real record shown in the drill-down modal comes from the same
  // real endpoints the rest of the app already uses (dealsService/
  // quotesService) — this dashboard never invents or duplicates data, only
  // surfaces it. Owner/admin's store override is passed through so a
  // filtered dashboard view drills into a matching filtered list, never a
  // wider org-wide one. (Email drill-downs now live directly on the
  // Customers & Email tab's own full-list view, not this generic modal.)
  const { data: drillItems, isLoading: drillLoading } = useQuery({
    queryKey: ['analytics-dashboard-drilldown', drillDown, dateFrom, dateTo, storeId],
    queryFn: async (): Promise<DrillDownRow[]> => {
      if (!drillDown) return [];

      if (drillDown.kind === 'deals') {
        const result = await dealsService.listFiltered(
          {
            dateFrom,
            dateTo,
            ...(drillDown.dateField ? { dateField: drillDown.dateField } : {}),
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
    },
    enabled: !!drillDown,
  });

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.pageTitle}>Analytics Dashboard</div>
          <div className={styles.pageSubtitle}>
            {data
              ? `Showing ${data.scope.level === 'org' ? 'the whole organization' : data.scope.level === 'store' ? (data.scope.storeName ?? 'your store') : 'your own pipeline'} for ${dateFrom} to ${dateTo}`
              : 'Loading…'}
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
          <MonthYearFilterPopup value={range} onChange={setRange} />
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
            <Tabs items={visibleTabs} activeId={activeTab} onChange={setActiveTab} />
          </div>

          {activeTab === 'overview' && (
            <div className={styles.tabContent}>
              <SectionCard title="Revenue & Target" icon={FiTarget}>
                <p className={styles.sectionNote}>Sales Targets are set per calendar month — this section reflects the month selected above.</p>
                <div className={styles.statsGrid}>
                  <StatTile
                    icon={FiTrendingUp}
                    value={money(data.revenue.achieved)}
                    label="Total Revenue"
                    onClick={() =>
                      setDrillDown({
                        kind: 'deals',
                        title: 'Won Deals (Revenue)',
                        dealStatus: ['won'],
                        // Total Revenue itself is summed by expectedClosingDate
                        // (SalesAnalyticsService.getAchievement), not createdAt —
                        // match that field here so the list reconciles with the
                        // figure that was clicked, instead of showing a
                        // createdAt-scoped set that can span unrelated months.
                        dateField: 'expectedClosingDate',
                      })
                    }
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
                <p className={styles.sectionNote}>Trailing 6 months, ending on the month selected above.</p>
                <RevenueProgressChart points={data.revenueTrend} />
              </SectionCard>

              <SectionCard title="Won vs Lost Revenue" icon={FiBarChart2}>
                <p className={styles.sectionNote}>Reflects the month selected above.</p>
                <WonLostTrendChart
                  metric="value"
                  points={[
                    {
                      period: `${dateFrom} – ${dateTo}`,
                      wonCount: data.deals.wonCount,
                      wonValue: data.deals.wonValue,
                      lostCount: data.deals.lostCount,
                      lostValue: data.deals.lostValue,
                    },
                  ]}
                  onSelect={(_p, dealStatus) =>
                    setDrillDown({
                      kind: 'deals',
                      title: dealStatus === 'won' ? 'Won Deals' : 'Lost Deals',
                      dealStatus: [dealStatus],
                      // Must match this chart's own bar values, which are
                      // now expectedClosingDate-scoped (see
                      // analytics-dashboard.service.ts's dealMatch) — real
                      // bug, reported live: the bar showed the right
                      // filtered number but its drill-down still queried by
                      // createdAt, so the popup showed every deal the org
                      // has ever had instead of just this period's.
                      dateField: 'expectedClosingDate',
                    })
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
                    totalLabel="deals in this range"
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
                        // Same fix as the Won vs Lost Revenue chart above —
                        // this donut's own won/lost/open counts are now
                        // expectedClosingDate-scoped, so the drill-down must
                        // match or it shows every deal instead of this
                        // period's.
                        dateField: 'expectedClosingDate',
                      })
                    }
                  />
                </SectionCard>

                <SectionCard title="Quotes: Accepted / Not Accepted" icon={FiPieChart}>
                  <DealSplitDonut
                    totalLabel="quotes in this range"
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

              {/* Enquiry->Quote traceability and AR/payment tracking both
                  live here — every quote-lifecycle question (won/lost,
                  accepted/not, where did it come from, is it paid) answered
                  in one tab instead of three. */}
              <EnquiryConversionSection dateFrom={dateFrom} dateTo={dateTo} storeId={canOverrideStore ? storeId : undefined} />
              <QuotesPaymentsSection dateFrom={dateFrom} dateTo={dateTo} storeId={canOverrideStore ? storeId : undefined} />
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
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setDrillDown({
                          kind: 'deals',
                          title: `${r.userName}'s Won Deals`,
                          dealStatus: ['won'],
                          ownerId: [r.userId],
                          // Leaderboard revenue is now expectedClosingDate-
                          // scoped too (same getConsultantPerformance call,
                          // fed the fixed dealMatch) — same fix as the two
                          // drill-downs above, for the same reason.
                          dateField: 'expectedClosingDate',
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return;
                        e.preventDefault();
                        setDrillDown({
                          kind: 'deals',
                          title: `${r.userName}'s Won Deals`,
                          dealStatus: ['won'],
                          ownerId: [r.userId],
                          dateField: 'expectedClosingDate',
                        });
                      }}
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

              {/* Work Completion & Productivity — a strict superset of the
                  old "Sales Work Breakdown" table (deals AND emails AND
                  quotes per employee, not deals alone), so that table was
                  retired rather than kept alongside a now-redundant view. */}
              <ProductivitySection dateFrom={dateFrom} dateTo={dateTo} storeId={canOverrideStore ? storeId : undefined} />
            </div>
          )}

          {activeTab === 'customers' && (
            <CustomersAndEmailSection dateFrom={dateFrom} dateTo={dateTo} storeId={canOverrideStore ? storeId : undefined} />
          )}

          {activeTab === 'bi-vendor' && <VendorProfitabilitySection dateFrom={dateFrom} dateTo={dateTo} />}
          {activeTab === 'bi-followups' && <AiFollowupSummarySection />}
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
