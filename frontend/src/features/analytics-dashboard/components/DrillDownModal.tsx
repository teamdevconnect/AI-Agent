import { Modal, Skeleton } from '@/components/ui';
import { formatINR as money } from '@/utils/currency';
import styles from '../analytics-dashboard.module.css';

export interface DrillDownRow {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  value?: number;
}

// Generic, dumb list renderer — every data-shape-specific mapping (deals/
// quotes/emails -> DrillDownRow) happens in the page, so this component
// never needs to know which of the three data types it's showing.
export function DrillDownModal({
  open,
  onClose,
  title,
  isLoading,
  rows,
  formatValue,
  onRowClick,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  isLoading: boolean;
  rows: DrillDownRow[];
  // Additive, backward-compatible — Business Intelligence needs percentage/
  // count formatting for several sections, not just this component's
  // original hardcoded INR currency. Omitted (the default) keeps every
  // existing call site's money() formatting unchanged.
  formatValue?: (n: number) => string;
  // Additive — the Customers & Email tab's popups drill a second level deep
  // (a business row opens its correlated emails, a missed-email row opens
  // the full email). Omitted (the default) keeps every existing call site's
  // static, non-clickable rows unchanged.
  onRowClick?: (row: DrillDownRow) => void;
}) {
  const renderValue = formatValue ?? money;
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={640}>
      <div className={styles.drillDownList}>
        {isLoading ? (
          <>
            <Skeleton height={56} />
            <Skeleton height={56} />
            <Skeleton height={56} />
          </>
        ) : rows.length === 0 ? (
          <div className={styles.emptyState}>No records found for this selection.</div>
        ) : (
          rows.map((r) => {
            const content = (
              <>
                <div className={styles.listItemMain}>
                  <span className={styles.listItemTitle}>{r.title}</span>
                  {(r.subtitle || r.meta) && (
                    <span className={styles.listItemMeta}>
                      {r.subtitle}
                      {r.subtitle && r.meta ? ' · ' : ''}
                      {r.meta}
                    </span>
                  )}
                </div>
                {r.value !== undefined && <strong>{renderValue(r.value)}</strong>}
              </>
            );
            return onRowClick ? (
              <button key={r.id} type="button" className={styles.listItem} onClick={() => onRowClick(r)}>
                {content}
              </button>
            ) : (
              <div key={r.id} className={styles.listItem}>
                {content}
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}
