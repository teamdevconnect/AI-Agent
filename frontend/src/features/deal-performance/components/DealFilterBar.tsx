import { CUSTOMER_TYPES, LEAD_SOURCES, REGIONS, type DealFilters } from '@/services/dealsService';
import { Input } from '@/components/ui';
import { DateRangeControl } from './DateRangeControl';
import { MultiSelectDropdown, type MultiSelectOption } from './MultiSelectDropdown';
import styles from '../deal-performance.module.css';

const STATUS_OPTIONS: MultiSelectOption[] = [
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];
const LEAD_SOURCE_OPTIONS: MultiSelectOption[] = LEAD_SOURCES.map((v) => ({ value: v, label: v.replace('_', ' ') }));
const CUSTOMER_TYPE_OPTIONS: MultiSelectOption[] = CUSTOMER_TYPES.map((v) => ({ value: v, label: v }));
const REGION_OPTIONS: MultiSelectOption[] = REGIONS.map((v) => ({ value: v, label: v }));

export interface DealFilterBarProps {
  filters: DealFilters;
  onChange: (filters: DealFilters) => void;
  storeOptions: MultiSelectOption[];
  ownerOptions: MultiSelectOption[];
  showStoreFilter: boolean;
}

function parseCsvInput(value: string): string[] | undefined {
  if (!value.trim()) return undefined;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// One filter row above every widget (not per-widget filters) — enterprise
// filter set: Date Range, Sales Consultant, Store, Deal Status, Deal Stage,
// Lead Source, Product, Customer Type, Deal Value Range, Region. Grouped
// into two visual rows (date/value range, then category multi-selects) so
// it reads as an organized toolbar rather than one long wrapped strip.
export function DealFilterBar({ filters, onChange, storeOptions, ownerOptions, showStoreFilter }: DealFilterBarProps) {
  const set = <K extends keyof DealFilters>(key: K, value: DealFilters[K]) => onChange({ ...filters, [key]: value });

  return (
    <div className={styles.filterBar}>
      <div className={styles.filterRow}>
        <DateRangeControl value={{ dateFrom: filters.dateFrom, dateTo: filters.dateTo }} onChange={(r) => onChange({ ...filters, ...r })} />
        <div className={styles.valueField}>
          <Input
            label="Min Value (₹)"
            type="number"
            min={0}
            placeholder="0"
            value={filters.valueMin ?? ''}
            onChange={(e) => set('valueMin', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div className={styles.valueField}>
          <Input
            label="Max Value (₹)"
            type="number"
            min={0}
            placeholder="Any"
            value={filters.valueMax ?? ''}
            onChange={(e) => set('valueMax', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      <div className={styles.filterRow}>
        {showStoreFilter && (
          <MultiSelectDropdown label="Store" options={storeOptions} selected={filters.storeId ?? []} onChange={(v) => set('storeId', v.length ? v : undefined)} />
        )}
        <MultiSelectDropdown label="Consultant" options={ownerOptions} selected={filters.ownerId ?? []} onChange={(v) => set('ownerId', v.length ? v : undefined)} />
        <MultiSelectDropdown
          label="Status"
          options={STATUS_OPTIONS}
          selected={filters.dealStatus ?? []}
          onChange={(v) => set('dealStatus', v.length ? (v as DealFilters['dealStatus']) : undefined)}
        />
        <MultiSelectDropdown label="Lead Source" options={LEAD_SOURCE_OPTIONS} selected={filters.leadSource ?? []} onChange={(v) => set('leadSource', v.length ? v : undefined)} />
        <MultiSelectDropdown label="Customer Type" options={CUSTOMER_TYPE_OPTIONS} selected={filters.customerType ?? []} onChange={(v) => set('customerType', v.length ? v : undefined)} />
        <MultiSelectDropdown label="Region" options={REGION_OPTIONS} selected={filters.region ?? []} onChange={(v) => set('region', v.length ? v : undefined)} />
      </div>

      <div className={styles.filterRow}>
        <div className={styles.valueField} style={{ width: 220 }}>
          <Input
            label="Stage"
            placeholder="e.g. proposal, negotiation"
            value={(filters.stageId ?? []).join(', ')}
            onChange={(e) => set('stageId', parseCsvInput(e.target.value))}
          />
        </div>
        <div className={styles.valueField} style={{ width: 220 }}>
          <Input
            label="Product"
            placeholder="e.g. CRM Suite"
            value={(filters.product ?? []).join(', ')}
            onChange={(e) => set('product', parseCsvInput(e.target.value))}
          />
        </div>
        <span className={styles.filterHelp}>
          Stage/Product accept comma-separated values. Date filters match a deal's expected/closing date — this CRM has no separate close
          timestamp yet.
        </span>
      </div>
    </div>
  );
}
