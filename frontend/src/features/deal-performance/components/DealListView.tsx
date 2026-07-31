import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Skeleton } from '@/components/ui';
import { FiArrowLeft } from 'react-icons/fi';
import { formatINR as money } from '@/utils/currency';
import { dealsService, type DealFilters } from '@/services/dealsService';
import { formatStageLabel } from '@/utils/stageLabel';
import styles from '../deal-performance.module.css';

const STATUS_VARIANT: Record<'open' | 'won' | 'lost', 'neutral' | 'success' | 'danger'> = {
  open: 'neutral',
  won: 'success',
  lost: 'danger',
};

const PAGE_SIZE = 25;

// Drill-down detail view, state-swap style (same pattern as
// dashboard/components/AgentFocusedView.tsx) rather than a modal — Modal.tsx
// is reserved for the create/edit CRUD form only, keeping the two
// interaction patterns distinct.
export function DealListView({ title, filters, onBack }: { title: string; filters: DealFilters; onBack: () => void }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['deal-performance-deal-list', filters, page],
    queryFn: () => dealsService.listFiltered(filters, page, PAGE_SIZE),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className={styles.section}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.pageTitle}>{title}</div>
          <div className={styles.pageSubtitle}>{data ? `${data.total} deal(s)` : 'Loading…'}</div>
        </div>
        <Button type="button" variant="ghost" size="sm" leftIcon={<FiArrowLeft />} onClick={onBack}>
          Back to Dashboard
        </Button>
      </div>

      {isLoading || !data ? (
        <Skeleton height={280} />
      ) : data.items.length === 0 ? (
        <div className={styles.emptyState}>No deals match this selection.</div>
      ) : (
        <>
          {data.items.map((d) => (
            <div key={d._id} className={styles.listItem}>
              <div className={styles.listItemMain}>
                <span className={styles.listItemTitle}>{d.name}</span>
                <span className={styles.listItemMeta}>
                  {d.expectedClosingDate ? `Expected close: ${d.expectedClosingDate}` : 'No close date set'}
                  {d.stageId ? ` · ${formatStageLabel(d.stageId)}` : ''}
                </span>
              </div>
              <Badge variant={STATUS_VARIANT[d.dealStatus]}>{d.dealStatus}</Badge>
              <span className={styles.rankValue}>{money(d.monetaryValue)}</span>
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
