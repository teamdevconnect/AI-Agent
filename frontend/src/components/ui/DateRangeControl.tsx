import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Tabs } from './Tabs';
import styles from './DateRangeControl.module.css';

export interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7', label: '7 Days', days: 7 },
  { id: '30', label: '30 Days', days: 30 },
  { id: '90', label: '90 Days', days: 90 },
  { id: 'week', label: 'This Week' },
  { id: 'lastWeek', label: 'Last Week' },
  { id: 'month', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'quarter', label: 'This Quarter' },
  { id: 'lastQuarter', label: 'Last Quarter' },
  { id: 'year', label: 'This Year' },
  { id: 'lastYear', label: 'Last Year' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom' },
];

const fmt = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD');

// Quarter boundaries computed manually (no dayjs QuarterOfYear plugin
// installed) — the quarter's first month is the 0-indexed month rounded
// down to the nearest multiple of 3.
function quarterStart(d: dayjs.Dayjs): dayjs.Dayjs {
  return d.month(Math.floor(d.month() / 3) * 3).startOf('month');
}
function quarterEnd(d: dayjs.Dayjs): dayjs.Dayjs {
  return quarterStart(d).add(2, 'month').endOf('month');
}

// Same rule for every "current period" preset (week/month/quarter/year):
// start of that period → today, never the period's own end — there's no
// data beyond today anyway, and this matches "This Month" 's own
// long-established, user-validated semantics (opened on Aug 12 → Aug 1
// through Aug 12, not Aug 1 through Aug 31). "Last X" presets use the full,
// already-elapsed period's real start/end since there's no "today" bound to
// apply.
function presetToRange(id: string): DateRange {
  const today = dayjs();
  switch (id) {
    case 'today':
      return { dateFrom: fmt(today), dateTo: fmt(today) };
    case 'yesterday': {
      const y = today.subtract(1, 'day');
      return { dateFrom: fmt(y), dateTo: fmt(y) };
    }
    case 'week':
      return { dateFrom: fmt(today.startOf('week')), dateTo: fmt(today) };
    case 'lastWeek': {
      const lastWeek = today.subtract(1, 'week');
      return { dateFrom: fmt(lastWeek.startOf('week')), dateTo: fmt(lastWeek.endOf('week')) };
    }
    case 'month':
      return { dateFrom: fmt(today.startOf('month')), dateTo: fmt(today) };
    case 'lastMonth': {
      const lastMonth = today.subtract(1, 'month');
      return { dateFrom: fmt(lastMonth.startOf('month')), dateTo: fmt(lastMonth.endOf('month')) };
    }
    case 'quarter':
      return { dateFrom: fmt(quarterStart(today)), dateTo: fmt(today) };
    case 'lastQuarter': {
      const lastQuarter = quarterStart(today).subtract(1, 'day');
      return { dateFrom: fmt(quarterStart(lastQuarter)), dateTo: fmt(quarterEnd(lastQuarter)) };
    }
    case 'year':
      return { dateFrom: fmt(today.startOf('year')), dateTo: fmt(today) };
    case 'lastYear': {
      const lastYear = today.subtract(1, 'year');
      return { dateFrom: fmt(lastYear.startOf('year')), dateTo: fmt(lastYear.endOf('year')) };
    }
    case 'all':
      return {};
    default: {
      const preset = PRESETS.find((p) => p.id === id);
      if (!preset?.days) return {};
      return { dateFrom: fmt(today.subtract(preset.days, 'day')), dateTo: fmt(today) };
    }
  }
}

// Matches `value` back to whichever preset produces that exact range (or
// 'all'/'custom' when nothing matches) — used both for the initial active
// tab and to re-sync it whenever `value` changes for a reason other than
// this control's own click (e.g. a saved view applied from outside, or a
// default range set on mount that happens to equal a real preset). Local
// `activeId` state alone used to only ever get set once on mount, so an
// external value change left the wrong tab highlighted indefinitely.
function deriveActiveId(value: DateRange, presetIds: string[]): string {
  if (!value.dateFrom && !value.dateTo) {
    return presetIds.includes('all') ? 'all' : 'custom';
  }
  const match = presetIds.find((id) => {
    if (id === 'custom' || id === 'all') return false;
    const range = presetToRange(id);
    return range.dateFrom === value.dateFrom && range.dateTo === value.dateTo;
  });
  return match ?? 'custom';
}

// Canned ranges follow Tabs.tsx's existing precedent (used elsewhere for
// 7/30-day windows); "Custom" reveals two plain date inputs. Consumers
// decide which date field this filters against (e.g. Deal.expectedClosingDate,
// FinanceDocument.invoiceDate) — this component is deliberately unaware of
// that. Promoted from features/deal-performance to components/ui in
// Phase 10a once Finance became its second consumer.
//
// `presets` lets a consumer request its own ordered subset of the full
// preset list above (see AnalyticsDashboardPage.tsx) without affecting any
// other consumer — omitted (the default) renders exactly today's original
// 7-item list, so every existing call site is unchanged.
const DEFAULT_PRESET_IDS = ['today', '7', '30', '90', 'month', 'all', 'custom'];

export function DateRangeControl({
  value,
  onChange,
  presets,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  presets?: string[];
}) {
  const visiblePresetIds = presets ?? DEFAULT_PRESET_IDS;
  const visiblePresets = visiblePresetIds
    .map((id) => PRESETS.find((p) => p.id === id))
    .filter((p): p is (typeof PRESETS)[number] => !!p);

  const [activeId, setActiveId] = useState<string>(() => deriveActiveId(value, visiblePresetIds));

  // Re-derives whenever the value itself changes (not on every render —
  // clicking "Custom" alone doesn't change `value`, so it isn't immediately
  // overridden back out of custom mode by this effect).
  useEffect(() => {
    setActiveId(deriveActiveId(value, visiblePresetIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.dateFrom, value.dateTo]);

  const handlePreset = (id: string) => {
    setActiveId(id);
    if (id !== 'custom') onChange(presetToRange(id));
  };

  return (
    <div className={styles.wrapper}>
      <Tabs items={visiblePresets.map((p) => ({ id: p.id, label: p.label }))} activeId={activeId} onChange={handlePreset} />
      {activeId === 'custom' && (
        <div className={styles.customRow}>
          <input
            type="date"
            className={styles.dateInput}
            value={value.dateFrom ?? ''}
            onChange={(e) => onChange({ ...value, dateFrom: e.target.value || undefined })}
          />
          <span>–</span>
          <input
            type="date"
            className={styles.dateInput}
            value={value.dateTo ?? ''}
            onChange={(e) => onChange({ ...value, dateTo: e.target.value || undefined })}
          />
        </div>
      )}
    </div>
  );
}
