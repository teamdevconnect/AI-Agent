import type { AnalyticsDashboardOverview } from '@/services/analyticsDashboardService';
import styles from './WorkBreakdownTable.module.css';

// A plain table, not a chart — the whole point of this widget (per the
// user's confirmed scope) is the multi-column per-person comparison a
// ranked list can't show (won/lost/open/conversion all at once).
export function WorkBreakdownTable({
  rows,
  onSelectPerson,
}: {
  rows: AnalyticsDashboardOverview['workBreakdown'];
  onSelectPerson?: (userId: string, userName: string) => void;
}) {
  if (rows.length === 0) {
    return <div className={styles.emptyState}>No sales team members in scope for this period.</div>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Name</th>
          <th>Won</th>
          <th>Lost</th>
          <th>Open</th>
          <th>Conversion</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.userId}
            className={onSelectPerson ? styles.clickableRow : undefined}
            onClick={onSelectPerson ? () => onSelectPerson(r.userId, r.userName) : undefined}
          >
            <td>{r.userName}</td>
            <td>{r.wonCount}</td>
            <td>{r.lostCount}</td>
            <td>{r.openCount}</td>
            <td>{r.conversionRate !== null ? `${r.conversionRate}%` : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
