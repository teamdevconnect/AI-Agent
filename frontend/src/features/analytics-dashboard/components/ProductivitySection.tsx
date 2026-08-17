import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SectionCard, Skeleton } from '@/components/ui';
import { formatINR as money } from '@/utils/currency';
import { employeeProductivityService } from '@/services/employeeProductivityService';
import biStyles from '@/features/business-intelligence/business-intelligence.module.css';
import styles from '../analytics-dashboard.module.css';

function bucketCell(assigned: number, completed: number, pending: number, overdue: number) {
  return (
    <span>
      {completed}/{assigned} done
      {overdue > 0 && <span style={{ color: 'var(--color-danger)' }}> · {overdue} overdue</span>}
      {pending > 0 && <span className={biStyles.fadeCaption}> · {pending} pending</span>}
    </span>
  );
}

// Business Intelligence section 3 — Employee Work Completion & Productivity,
// merged into the Dashboard's own "Team Performance" companion tab.
export function ProductivitySection({ dateFrom, dateTo, storeId }: { dateFrom: string; dateTo: string; storeId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['dash-productivity', dateFrom, dateTo, storeId],
    queryFn: () => employeeProductivityService.getOverview({ dateFrom, dateTo, employeeId: [], storeId: storeId ? [storeId] : [] }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  return (
    <div className={styles.tabContent}>
      {data && data.quoteCoveragePct !== null && data.quoteCoveragePct < 100 && (
        <div className={biStyles.coverageNote}>
          Quote ownership coverage: {data.quoteCoveragePct}% of quotes in this range have a real assigned employee.
        </div>
      )}
      <SectionCard title="Emails, Quotes & Deals — Assigned / Completed / Pending / Overdue">
        {isLoading || !data ? (
          <Skeleton height={220} />
        ) : data.rows.length === 0 ? (
          <div className={styles.emptyState}>No eligible employees in scope for this period.</div>
        ) : (
          <div className={biStyles.tableWrapper}>
            <table className={biStyles.table}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Emails</th>
                  <th>Quotes</th>
                  <th>Deals</th>
                  <th>Won Value</th>
                  <th>Overall Completion</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.userId}>
                    <td>{r.userName}</td>
                    <td>{bucketCell(r.emails.assigned, r.emails.completed, r.emails.pending, r.emails.overdue)}</td>
                    <td>{bucketCell(r.quotes.assigned, r.quotes.completed, r.quotes.pending, r.quotes.overdue)}</td>
                    <td>{bucketCell(r.deals.assigned, r.deals.completed, r.deals.pending, r.deals.overdue)}</td>
                    <td>{money(r.deals.wonValue)}</td>
                    <td>{r.overallCompletionPct !== null ? `${r.overallCompletionPct}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
