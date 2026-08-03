import { Badge } from '@/components/ui';
import type { BusinessTableRow } from '@/services/customerActivityService';
import styles from '../deal-performance.module.css';

// businessNameSource !== 'account' means the name was derived (from a
// quote's client_details or a heuristic split of the deal name) rather than
// a real linked Account record — flagged with a hint rather than presented
// as equally authoritative, matching this app's established "coverage/
// source transparency" convention (e.g. Breakdown.coveragePct elsewhere on
// this page).
function sourceHint(source: BusinessTableRow['businessNameSource']): string | undefined {
  if (source === 'account') return undefined;
  if (source === 'quote_client_details') return 'From quote client details';
  return 'Derived from deal name';
}

export function CustomerActivityTable({ rows }: { rows: BusinessTableRow[] }) {
  if (rows.length === 0) {
    return <div className={styles.emptyState}>No customer/business data in scope yet.</div>;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Business</th>
            <th>Quote #</th>
            <th>Deals</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>
                <div className={styles.listItemMain}>
                  <span className={styles.listItemTitle}>{row.businessName}</span>
                  {sourceHint(row.businessNameSource) && <span className={styles.listItemMeta}>{sourceHint(row.businessNameSource)}</span>}
                </div>
              </td>
              <td>{row.quoteNumbers.length ? row.quoteNumbers.join(', ') : '—'}</td>
              <td>
                {row.dealCount} ({row.openDealCount} open, {row.wonCount} won, {row.lostCount} lost)
              </td>
              <td>
                <div className={styles.badgeRow}>
                  {row.isNew && <Badge variant="accent">New</Badge>}
                  {!row.isNew && <Badge variant="neutral">Existing</Badge>}
                  {row.isFollowUp && <Badge variant="warning">Follow-up</Badge>}
                  {row.actionedToday && <Badge variant="success">Actioned today</Badge>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
