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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  isLoading: boolean;
  rows: DrillDownRow[];
}) {
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
          rows.map((r) => (
            <div key={r.id} className={styles.listItem}>
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
              {r.value !== undefined && <strong>{money(r.value)}</strong>}
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
