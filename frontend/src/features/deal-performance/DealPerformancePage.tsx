import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { FiDownload, FiPlus } from 'react-icons/fi';
import { Button, Dropdown, Skeleton } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { hasRole } from '@/utils/roles';
import { extractErrorMessage } from '@/utils/errors';
import { formatINR as money } from '@/utils/currency';
import { dealsService, type Deal, type DealFilters } from '@/services/dealsService';
import { dealPerformanceService, type DealPerformancePreset } from '@/services/dealPerformanceService';
import { usersService } from '@/services/usersService';
import { organizationsService } from '@/services/organizationsService';
import { StatTile } from '@/features/dashboard/components/StatTile';
import { DealFilterBar } from './components/DealFilterBar';
import { MultiSelectDropdown } from './components/MultiSelectDropdown';
import { SavedViewsBar } from './components/SavedViewsBar';
import { WonLostTrendChart } from './components/WonLostTrendChart';
import { RevenueProgressChart } from './components/RevenueProgressChart';
import { PipelineByStageChart } from './components/PipelineByStageChart';
import { CustomerAcquisitionTrendChart } from './components/CustomerAcquisitionTrendChart';
import { RankedBreakdownList } from './components/RankedBreakdownList';
import { DealListView } from './components/DealListView';
import { DealFormModal } from './components/DealFormModal';
import { formatStageLabel } from '@/utils/stageLabel';
import styles from './deal-performance.module.css';

function periodToDateRange(period: string): { dateFrom: string; dateTo: string } {
  const [year, month] = period.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return { dateFrom: `${period}-01`, dateTo: `${period}-${String(lastDay).padStart(2, '0')}` };
}

function withoutDateRange(filters: DealFilters): DealFilters {
  const { dateFrom: _dateFrom, dateTo: _dateTo, ...rest } = filters;
  return rest;
}

const WIDGET_OPTIONS = [
  { value: 'summary', label: 'Summary KPIs' },
  { value: 'wonLostTrend', label: 'Won vs Lost Trend' },
  { value: 'pipelineByStage', label: 'Pipeline Overview' },
  { value: 'achievement', label: 'Target vs Achievement' },
  { value: 'revenueProgress', label: 'Monthly Revenue Progress' },
  { value: 'conversionFunnel', label: 'Conversion Funnel' },
  { value: 'consultantPerformance', label: 'Consultant Performance' },
  { value: 'leadSourcePerformance', label: 'Lead Source Performance' },
  { value: 'productPerformance', label: 'Product Performance' },
  { value: 'geographicDistribution', label: 'Geographic Distribution' },
  { value: 'customerAcquisitionTrend', label: 'Customer Acquisition Trend' },
];

interface DrillDown {
  title: string;
  filters: DealFilters;
}

// A wholly separate page from the Owner/Manager/Consultant dashboards (see
// Phase 9a plan notes) — those are fixed-layout "at a glance" views; this is
// a 10-filter/10-widget analytics surface with exports and saved views.
// Consultants are excluded — they already have their own personal view.
export function DealPerformancePage() {
  const user = useAuthStore((s) => s.user);
  const canSeeStoreFilter = hasRole(user, 'owner') || hasRole(user, 'admin');
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<DealFilters>({});
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);
  const [formModal, setFormModal] = useState<{ open: boolean; deal?: Deal }>({ open: false });
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const users = await usersService.list();
        setEmployees(users.filter((u) => u.roles.includes('manager') || u.roles.includes('consultant')).map((u) => ({ id: u.id, name: u.name })));
      } catch {
        // GET /users is admin-only — a manager viewing this page simply
        // gets an empty owner picker in the create/edit form, not a crash.
        setEmployees([]);
      }
      try {
        const storeList = await organizationsService.listStores();
        setStores(storeList.map((s) => ({ id: s._id, name: s.name })));
      } catch {
        setStores([]);
      }
    })();
  }, []);

  const { data: presets = [] } = useQuery({ queryKey: ['deal-performance-presets'], queryFn: () => dealPerformanceService.listPresets() });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['deal-performance-overview', filters],
    queryFn: () => dealPerformanceService.getOverview(filters),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });

  const isVisible = (key: string) => !hiddenWidgets.includes(key);

  const handleApplyPreset = (preset: DealPerformancePreset) => {
    setFilters(preset.filters);
    setHiddenWidgets(preset.hiddenWidgets);
    toast.success(`Applied "${preset.name}"`);
  };

  const handleSavePreset = async (name: string) => {
    try {
      await dealPerformanceService.createPreset({ name, filters, hiddenWidgets });
      await queryClient.invalidateQueries({ queryKey: ['deal-performance-presets'] });
      toast.success('View saved');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleDeletePreset = async (id: string) => {
    try {
      await dealPerformanceService.deletePreset(id);
      await queryClient.invalidateQueries({ queryKey: ['deal-performance-presets'] });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    try {
      await dealsService.downloadExport(format, filters);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const productSuggestions = data?.productPerformance.breakdown.map((b) => b.key).filter((k) => k !== 'Other') ?? [];

  if (drillDown) {
    return (
      <div className={styles.page}>
        <DealListView title={drillDown.title} filters={drillDown.filters} onBack={() => setDrillDown(null)} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.pageTitle}>Deal Performance & AI Analytics</div>
          <div className={styles.pageSubtitle}>
            {data
              ? `${data.summary.totalDeals} deal(s) in view · achievement period ${data.achievement.period} · use the filters below to narrow this down`
              : 'Loading…'}
          </div>
        </div>
        <div className={styles.headerActions}>
          <MultiSelectDropdown label="Hidden Widgets" options={WIDGET_OPTIONS} selected={hiddenWidgets} onChange={setHiddenWidgets} />
          <Dropdown
            trigger={
              <Button type="button" variant="ghost" size="sm" leftIcon={<FiDownload />}>
                Export
              </Button>
            }
            items={[
              { id: 'csv', label: 'Export as CSV', onSelect: () => void handleExport('csv') },
              { id: 'xlsx', label: 'Export as Excel', onSelect: () => void handleExport('xlsx') },
              { id: 'pdf', label: 'Export as PDF', onSelect: () => void handleExport('pdf') },
            ]}
          />
          <Button type="button" size="sm" leftIcon={<FiPlus />} onClick={() => setFormModal({ open: true })}>
            New Deal
          </Button>
        </div>
      </div>

      <SavedViewsBar presets={presets} onApply={handleApplyPreset} onDelete={(id) => void handleDeletePreset(id)} onSaveNew={(name) => void handleSavePreset(name)} />

      <DealFilterBar
        filters={filters}
        onChange={setFilters}
        storeOptions={stores.map((s) => ({ value: s.id, label: s.name }))}
        ownerOptions={employees.map((e) => ({ value: e.id, label: e.name }))}
        showStoreFilter={canSeeStoreFilter}
      />

      {isLoading || !data ? (
        <>
          <Skeleton height={100} />
          <Skeleton height={220} />
          <Skeleton height={160} />
        </>
      ) : (
        <div className={clsx(isFetching && styles.fetching)}>
          {isVisible('summary') && (
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Summary</span>
              <div className={styles.statsGrid}>
                <StatTile value={data.summary.totalDeals} label="Total Deals" onClick={() => setDrillDown({ title: 'All Deals', filters })} />
                <StatTile
                  value={`${data.summary.wonCount} (${money(data.summary.wonValue)})`}
                  label="Won"
                  onClick={() => setDrillDown({ title: 'Won Deals', filters: { ...filters, dealStatus: ['won'] } })}
                />
                <StatTile
                  value={`${data.summary.lostCount} (${money(data.summary.lostValue)})`}
                  label="Lost"
                  onClick={() => setDrillDown({ title: 'Lost Deals', filters: { ...filters, dealStatus: ['lost'] } })}
                />
                <StatTile
                  value={`${data.summary.openCount} (${money(data.summary.openValue)})`}
                  label="Open Pipeline"
                  onClick={() => setDrillDown({ title: 'Open Deals', filters: { ...filters, dealStatus: ['open'] } })}
                />
                <StatTile value={data.summary.conversionRate === null ? '—' : `${data.summary.conversionRate}%`} label="Conversion Rate" />
                <StatTile value={data.summary.winRate === null ? '—' : `${data.summary.winRate}%`} label="Win Rate" />
                <StatTile value={data.summary.avgWonDealSize === null ? '—' : money(data.summary.avgWonDealSize)} label="Avg. Won Deal Size" />
              </div>
            </div>
          )}

          {isVisible('wonLostTrend') && (
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Won vs Lost Trend</span>
              <span className={styles.fadeCaption}>Click a bar to see that month's deals.</span>
              <WonLostTrendChart
                points={data.wonLostTrend}
                onSelect={(period, status) => {
                  const range = periodToDateRange(period);
                  setDrillDown({
                    title: `${status === 'won' ? 'Won' : 'Lost'} Deals — ${period}`,
                    filters: { ...filters, ...range, dealStatus: [status] },
                  });
                }}
              />
            </div>
          )}

          <div className={styles.twoColumn}>
            {isVisible('achievement') && (
              <div className={styles.section}>
                <span className={styles.sectionTitle}>Target vs Achievement — {data.achievement.period}</span>
                <div className={styles.statsGrid}>
                  <StatTile value={money(data.achievement.achieved)} label="Achieved" />
                  <StatTile value={data.achievement.targetAmount === null ? '—' : money(data.achievement.targetAmount)} label="Target" />
                  <StatTile value={data.achievement.achievementPct === null ? '—' : `${data.achievement.achievementPct}%`} label="Achievement" />
                  <StatTile value={money(data.achievement.remaining)} label="Remaining" />
                </div>
              </div>
            )}
            {isVisible('pipelineByStage') && (
              <div className={styles.section}>
                <span className={styles.sectionTitle}>Pipeline by Stage</span>
                <PipelineByStageChart
                  data={data.pipelineByStage.map((s) => ({ stageId: s.stageId, value: s.value }))}
                  valueLabel="Value"
                  caption={data.untaggedStageCount > 0 ? `${data.untaggedStageCount} open deal(s) have no stage set.` : undefined}
                  onSelect={(stageId) =>
                    setDrillDown({
                      title: `Open Deals — ${formatStageLabel(stageId)}`,
                      filters: { ...withoutDateRange(filters), stageId: [stageId], dealStatus: ['open'] },
                    })
                  }
                />
              </div>
            )}
          </div>

          {isVisible('revenueProgress') && (
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Monthly Revenue Progress</span>
              <RevenueProgressChart points={data.revenueProgress} />
            </div>
          )}

          {isVisible('conversionFunnel') && (
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Conversion Funnel (by Stage)</span>
              <PipelineByStageChart
                data={data.conversionFunnel.map((s) => ({ stageId: s.stageId, value: s.count }))}
                valueLabel="Deals"
                caption={data.conversionFunnelNote}
                onSelect={(stageId) => setDrillDown({ title: `Deals — ${formatStageLabel(stageId)}`, filters: { ...filters, stageId: [stageId] } })}
              />
            </div>
          )}

          {isVisible('consultantPerformance') && (
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Consultant Performance</span>
              <RankedBreakdownList
                items={data.consultantPerformance.map((c) => ({ key: c.userId, label: c.userName, value: c.wonValue, valueFormatted: money(c.wonValue) }))}
                emptyMessage="No employees in scope."
                onSelect={(userId) => {
                  const c = data.consultantPerformance.find((x) => x.userId === userId);
                  setDrillDown({ title: `${c?.userName ?? 'Consultant'}'s Deals`, filters: { ...filters, ownerId: [userId] } });
                }}
              />
            </div>
          )}

          <div className={styles.threeColumn}>
            {isVisible('leadSourcePerformance') && (
              <div className={styles.section}>
                <span className={styles.sectionTitle}>Lead Source Performance</span>
                <RankedBreakdownList
                  items={data.leadSourcePerformance.breakdown.map((b) => ({ key: b.key, label: b.key, value: b.count }))}
                  emptyMessage="No deals tagged with a lead source yet."
                  coverageNote={`${data.leadSourcePerformance.taggedCount} of ${data.leadSourcePerformance.totalCount} deals tagged (${data.leadSourcePerformance.coveragePct}%)`}
                  onSelect={(key) => setDrillDown({ title: `Lead Source: ${key}`, filters: { ...filters, leadSource: [key] } })}
                />
              </div>
            )}
            {isVisible('productPerformance') && (
              <div className={styles.section}>
                <span className={styles.sectionTitle}>Product Performance</span>
                <RankedBreakdownList
                  items={data.productPerformance.breakdown.map((b) => ({ key: b.key, label: b.key, value: b.count }))}
                  emptyMessage="No deals tagged with a product yet."
                  coverageNote={`${data.productPerformance.taggedCount} of ${data.productPerformance.totalCount} deals tagged (${data.productPerformance.coveragePct}%)`}
                  onSelect={(key) => (key === 'Other' ? undefined : setDrillDown({ title: `Product: ${key}`, filters: { ...filters, product: [key] } }))}
                />
              </div>
            )}
            {isVisible('geographicDistribution') && (
              <div className={styles.section}>
                <span className={styles.sectionTitle}>Geographic Distribution</span>
                <RankedBreakdownList
                  items={data.geographicDistribution.breakdown.map((b) => ({ key: b.key, label: b.key, value: b.count }))}
                  emptyMessage="No deals tagged with a region yet."
                  coverageNote={`${data.geographicDistribution.taggedCount} of ${data.geographicDistribution.totalCount} deals tagged (${data.geographicDistribution.coveragePct}%)`}
                  onSelect={(key) => setDrillDown({ title: `Region: ${key}`, filters: { ...filters, region: [key] } })}
                />
              </div>
            )}
          </div>

          {isVisible('customerAcquisitionTrend') && (
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Customer Acquisition Trend</span>
              <CustomerAcquisitionTrendChart points={data.customerAcquisitionTrend} />
            </div>
          )}
        </div>
      )}

      <DealFormModal
        open={formModal.open}
        deal={formModal.deal}
        employees={employees}
        stores={stores}
        productSuggestions={productSuggestions}
        onClose={() => setFormModal({ open: false })}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: ['deal-performance-overview'] })}
      />
    </div>
  );
}
