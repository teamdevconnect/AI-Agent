import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Badge, Button, SectionCard, Skeleton, StatTile } from '@/components/ui';
import { formatINR as money } from '@/utils/currency';
import { customerQuotePaymentService } from '@/services/customerQuotePaymentService';
import biStyles from '@/features/business-intelligence/business-intelligence.module.css';
import styles from '../analytics-dashboard.module.css';

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'neutral' | 'warning'> = {
  approved: 'success',
  rejected: 'danger',
  pending: 'warning',
};

const PAGE_SIZE = 20;

// Business Intelligence section 7 — Customer Quote & Payment Tracking.
// Purely read-only here by design — Paid/Outstanding are entirely driven by
// each quote's linked Royalty Invoice (see backend InvoicesService's
// syncQuotePaidAmount). Marking an invoice paid happens on the Royalty →
// Invoices page, never here, so this table can never drift into a second
// place that also writes payment state.
export function QuotesPaymentsSection({ dateFrom, dateTo, storeId }: { dateFrom: string; dateTo: string; storeId?: string }) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const filters = { dateFrom, dateTo, employeeId: [], storeId: storeId ? [storeId] : [] };

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dash-quote-payment-summary', filters],
    queryFn: () => customerQuotePaymentService.getSummary(filters),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const { data: list, isLoading: listLoading } = useQuery({
    queryKey: ['dash-quote-payment-quotes', filters, page, statusFilter],
    queryFn: () => customerQuotePaymentService.listQuotes(filters, page, PAGE_SIZE, statusFilter.length ? statusFilter : undefined),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const statusRow = (status: string) => summary?.byStatus.find((s) => s.status === status);

  return (
    <div className={styles.tabContent}>
      {summaryLoading || !summary ? (
        <Skeleton height={100} />
      ) : (
        <div className={styles.statsGrid}>
          <StatTile value={statusRow('approved')?.count ?? 0} label="Accepted Quotes" />
          <StatTile value={statusRow('rejected')?.count ?? 0} label="Rejected Quotes" />
          <StatTile value={statusRow('pending')?.count ?? 0} label="Pending Quotes" />
          <StatTile value={money(summary.totalPaid)} label="Total Paid" />
          <StatTile value={money(summary.totalOutstanding)} label="Total Outstanding" />
        </div>
      )}

      <SectionCard title="Aging (Outstanding by Days Past Due)">
        {summaryLoading || !summary ? (
          <Skeleton height={80} />
        ) : (
          <div className={biStyles.tableWrapper}>
            <table className={biStyles.table}>
              <thead>
                <tr>
                  {summary.agingBuckets.map((b) => (
                    <th key={b.bucket}>{b.bucket === 'noDueDate' ? 'No Due Date' : b.bucket}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {summary.agingBuckets.map((b) => (
                    <td key={b.bucket}>{money(b.amount)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Quotes"
        action={
          <div className={biStyles.formRow}>
            {['approved', 'pending', 'rejected'].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter.includes(s) ? 'primary' : 'ghost'}
                onClick={() => {
                  setStatusFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
                  setPage(1);
                }}
              >
                {s}
              </Button>
            ))}
          </div>
        }
      >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 0 }}>
          Paid/Outstanding reflect each quote's linked Invoice status — manage payment status on the Royalty → Invoices
          page; it updates here automatically.
        </p>
        {listLoading || !list ? (
          <Skeleton height={220} />
        ) : list.items.length === 0 ? (
          <div className={styles.emptyState}>No quotes match the current filters.</div>
        ) : (
          <>
            <div className={biStyles.tableWrapper}>
              <table className={biStyles.table}>
                <thead>
                  <tr>
                    <th>Quote</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Paid</th>
                    <th>Outstanding</th>
                    <th>Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((q) => (
                    <tr key={q._id}>
                      <td>{q.quoteNumber ?? q.quoteName ?? '—'}</td>
                      <td>{q.clientDetails?.companyName ?? '—'}</td>
                      <td>
                        <Badge variant={STATUS_VARIANT[q.clientApprovalStatus] ?? 'neutral'}>{q.clientApprovalStatus}</Badge>
                      </td>
                      <td>{money(q.quoteAmount)}</td>
                      <td>{money(q.paidAmount)}</td>
                      <td>{money(q.quoteAmount - q.paidAmount)}</td>
                      <td>{q.dueDate ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={biStyles.pagination}>
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span>
                Page {list.page} of {Math.max(1, Math.ceil(list.total / list.pageSize))} ({list.total} total)
              </span>
              <Button size="sm" variant="ghost" disabled={page * PAGE_SIZE >= list.total} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
