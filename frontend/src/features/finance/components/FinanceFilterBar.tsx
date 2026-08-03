import { useState } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { Button, DateRangeControl, Input, MultiSelectDropdown, type MultiSelectOption } from '@/components/ui';
import { PAYMENT_METHODS, PAYMENT_STATUSES, type FinanceFilters } from '@/services/financeDocumentsService';
import styles from '../finance.module.css';

const STATUS_OPTIONS: MultiSelectOption[] = PAYMENT_STATUSES.map((v) => ({ value: v, label: v.replace('_', ' ') }));
const METHOD_OPTIONS: MultiSelectOption[] = PAYMENT_METHODS.map((v) => ({ value: v, label: v.replace('_', ' ') }));

function parseCsvInput(value: string): string[] | undefined {
  if (!value.trim()) return undefined;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function countAdvancedActive(filters: FinanceFilters): number {
  return [filters.amountMin, filters.amountMax, filters.paymentMethod, filters.department, filters.costCenter, filters.expenseCategory].filter(
    (v) => v !== undefined,
  ).length;
}

export interface FinanceFilterBarProps {
  filters: FinanceFilters;
  onChange: (filters: FinanceFilters) => void;
}

// Enterprise filter toolbar mirroring deal-performance/components/DealFilterBar.tsx's
// grouped-row + collapsible-Advanced layout. Primary (Date, Vendor, Status)
// stays always visible; everything else collapses behind "More filters" by
// default — purely visual, no capability removed, an already-selected
// Advanced value stays applied while collapsed.
export function FinanceFilterBar({ filters, onChange }: FinanceFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const set = <K extends keyof FinanceFilters>(key: K, value: FinanceFilters[K]) => onChange({ ...filters, [key]: value });
  const advancedCount = countAdvancedActive(filters);

  return (
    <div className={styles.filterBar}>
      <div className={styles.filterRow}>
        <DateRangeControl value={{ dateFrom: filters.dateFrom, dateTo: filters.dateTo }} onChange={(r) => onChange({ ...filters, ...r })} />
        <div className={styles.valueField} style={{ width: 200 }}>
          <Input
            label="Vendor"
            placeholder="e.g. Microsoft"
            value={(filters.vendorName ?? []).join(', ')}
            onChange={(e) => set('vendorName', parseCsvInput(e.target.value))}
          />
        </div>
        <MultiSelectDropdown label="Status" options={STATUS_OPTIONS} selected={filters.paymentStatus ?? []} onChange={(v) => set('paymentStatus', v.length ? v : undefined)} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          rightIcon={showAdvanced ? <FiChevronUp /> : <FiChevronDown />}
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? 'Fewer filters' : `More filters${advancedCount ? ` (${advancedCount})` : ''}`}
        </Button>
      </div>

      {showAdvanced && (
        <>
          <div className={styles.filterRow}>
            <div className={styles.valueField}>
              <Input
                label="Min Amount"
                type="number"
                min={0}
                placeholder="0"
                value={filters.amountMin ?? ''}
                onChange={(e) => set('amountMin', e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
            <div className={styles.valueField}>
              <Input
                label="Max Amount"
                type="number"
                min={0}
                placeholder="Any"
                value={filters.amountMax ?? ''}
                onChange={(e) => set('amountMax', e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
            <MultiSelectDropdown label="Payment Method" options={METHOD_OPTIONS} selected={filters.paymentMethod ?? []} onChange={(v) => set('paymentMethod', v.length ? v : undefined)} />
          </div>

          <div className={styles.filterRow}>
            <div className={styles.valueField} style={{ width: 200 }}>
              <Input
                label="Department"
                placeholder="e.g. IT, Sales"
                value={(filters.department ?? []).join(', ')}
                onChange={(e) => set('department', parseCsvInput(e.target.value))}
              />
            </div>
            <div className={styles.valueField} style={{ width: 200 }}>
              <Input
                label="Cost Center"
                value={(filters.costCenter ?? []).join(', ')}
                onChange={(e) => set('costCenter', parseCsvInput(e.target.value))}
              />
            </div>
            <div className={styles.valueField} style={{ width: 200 }}>
              <Input
                label="Category"
                placeholder="e.g. Software, Travel"
                value={(filters.expenseCategory ?? []).join(', ')}
                onChange={(e) => set('expenseCategory', parseCsvInput(e.target.value))}
              />
            </div>
            <span className={styles.filterHelp}>
              Vendor/Department/Cost Center/Category accept comma-separated values. Date filters match a document's invoice date.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
