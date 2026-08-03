import styles from '../finance.module.css';

export interface RankedItem {
  key: string;
  label: string;
  value: number;
  valueFormatted?: string;
}

// Clone of deal-performance/components/RankedBreakdownList.tsx — reused for
// Vendor-wise Spending, Category-wise Spending, Payment Method Breakdown,
// Tax Breakdown, and the subscription-provider breakdown. A plain
// measure-per-named-category doesn't need its own chart color work, per
// the dataviz method already applied when this pattern was first built.
export function RankedBreakdownList({
  items,
  emptyMessage,
  coverageNote,
  onSelect,
}: {
  items: RankedItem[];
  emptyMessage: string;
  coverageNote?: string;
  onSelect?: (key: string) => void;
}) {
  return (
    <>
      {coverageNote && <span className={styles.coverageNote}>{coverageNote}</span>}
      {items.length === 0 ? (
        <div className={styles.emptyState}>{emptyMessage}</div>
      ) : (
        items.map((item, i) => (
          <div key={item.key} className={styles.rankRow}>
            <span className={styles.rankPosition}>#{i + 1}</span>
            <span className={styles.rankName} onClick={onSelect ? () => onSelect(item.key) : undefined}>
              {item.label}
            </span>
            <span className={styles.rankValue}>{item.valueFormatted ?? item.value.toLocaleString()}</span>
          </div>
        ))
      )}
    </>
  );
}
