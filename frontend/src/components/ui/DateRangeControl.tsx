import { useState } from 'react';
import dayjs from 'dayjs';
import { Tabs } from './Tabs';
import styles from './DateRangeControl.module.css';

export interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

const PRESETS = [
  { id: '7', label: '7 Days', days: 7 },
  { id: '30', label: '30 Days', days: 30 },
  { id: '90', label: '90 Days', days: 90 },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom' },
];

function presetToRange(id: string): DateRange {
  const today = dayjs();
  if (id === 'month') return { dateFrom: today.startOf('month').format('YYYY-MM-DD'), dateTo: today.format('YYYY-MM-DD') };
  if (id === 'all') return {};
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset?.days) return {};
  return { dateFrom: today.subtract(preset.days, 'day').format('YYYY-MM-DD'), dateTo: today.format('YYYY-MM-DD') };
}

// Canned ranges follow Tabs.tsx's existing precedent (used elsewhere for
// 7/30-day windows); "Custom" reveals two plain date inputs. Consumers
// decide which date field this filters against (e.g. Deal.expectedClosingDate,
// FinanceDocument.invoiceDate) — this component is deliberately unaware of
// that. Promoted from features/deal-performance to components/ui in
// Phase 10a once Finance became its second consumer.
export function DateRangeControl({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  const [activeId, setActiveId] = useState<string>(value.dateFrom || value.dateTo ? 'custom' : 'all');

  const handlePreset = (id: string) => {
    setActiveId(id);
    if (id !== 'custom') onChange(presetToRange(id));
  };

  return (
    <div className={styles.wrapper}>
      <Tabs items={PRESETS.map((p) => ({ id: p.id, label: p.label }))} activeId={activeId} onChange={handlePreset} />
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
