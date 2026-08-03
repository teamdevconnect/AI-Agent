import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Skeleton } from '@/components/ui';
import { FiArrowLeft } from 'react-icons/fi';
import { formatINR as money } from '@/utils/currency';
import { financeDocumentsService, type FinanceDocument, type FinanceFilters } from '@/services/financeDocumentsService';
import styles from '../finance.module.css';

const STATUS_VARIANT: Record<string, 'neutral' | 'success' | 'danger' | 'warning'> = {
  pending: 'neutral',
  overdue: 'danger',
  partially_paid: 'warning',
  paid: 'success',
  cancelled: 'neutral',
};

const PAGE_SIZE = 25;

// Drill-down detail view, state-swap style (same pattern as
// deal-performance/components/DealListView.tsx) — browsing many records is
// a separate job from reviewing one, which stays a Modal
// (FinanceDocumentReviewModal.tsx). Each row here opens that same modal.
export function FinanceDocumentListView({
  title,
  filters,
  onBack,
  onSelectDocument,
}: {
  title: string;
  filters: FinanceFilters;
  onBack: () => void;
  onSelectDocument: (doc: FinanceDocument) => void;
}) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['finance-document-list', filters, page],
    queryFn: () => financeDocumentsService.listFiltered(filters, page, PAGE_SIZE),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className={styles.section}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.pageTitle}>{title}</div>
          <div className={styles.pageSubtitle}>{data ? `${data.total} document(s)` : 'Loading…'}</div>
        </div>
        <Button type="button" variant="ghost" size="sm" leftIcon={<FiArrowLeft />} onClick={onBack}>
          Back to Dashboard
        </Button>
      </div>

      {isLoading || !data ? (
        <Skeleton height={280} />
      ) : data.items.length === 0 ? (
        <div className={styles.emptyState}>No documents match this selection.</div>
      ) : (
        <>
          {data.items.map((d) => (
            <div key={d._id} className={styles.listItem} onClick={() => onSelectDocument(d)} style={{ cursor: 'pointer' }}>
              <div className={styles.listItemMain}>
                <span className={styles.listItemTitle}>{d.vendorName ?? d.originalFilename}</span>
                <span className={styles.listItemMeta}>
                  {d.invoiceDate ? `Invoice: ${d.invoiceDate}` : 'No invoice date'}
                  {d.expenseCategory ? ` · ${d.expenseCategory}` : ''}
                </span>
              </div>
              <Badge variant={STATUS_VARIANT[d.paymentStatus] ?? 'neutral'}>{d.paymentStatus.replace('_', ' ')}</Badge>
              <span className={styles.rankValue}>{money(d.paymentAmount)}</span>
            </div>
          ))}

          {totalPages > 1 && (
            <div className={styles.headerActions}>
              <Button type="button" variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className={styles.pageSubtitle}>
                Page {page} of {totalPages}
              </span>
              <Button type="button" variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
