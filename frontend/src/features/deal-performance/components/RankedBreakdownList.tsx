import styles from '../deal-performance.module.css';

export interface RankedItem {
  key: string;
  label: string;
  value: number;
  valueFormatted?: string;
}

// Reused for Consultant Performance, Lead Source, Product, and Geographic
// Distribution — a plain measure-per-named-category doesn't need its own
// chart color work (per the dataviz method: color shouldn't re-encode what
// the ranking/length already shows), so this reuses the exact rank-row
// markup already proven in OwnerDashboardView.tsx's Store Rankings /
// Employee Leaderboard rather than introducing Pie/Funnel charts.
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
