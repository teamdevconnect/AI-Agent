import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiArrowLeft } from 'react-icons/fi';
import { Badge, Button, Skeleton } from '@/components/ui';
import {
  businessKnowledgeDocumentsService,
  type BusinessKnowledgeDocument,
  type BusinessKnowledgeDocumentFilters,
} from '@/services/businessKnowledgeDocumentsService';
import styles from '../business-knowledge.module.css';

const PAGE_SIZE = 25;

// Drill-down detail view, state-swap style — mirrors
// finance/components/FinanceDocumentListView.tsx exactly. Browsing many
// records is a separate job from reviewing one, which stays a Modal
// (BusinessKnowledgeDocumentReviewModal.tsx); each row here opens that modal.
export function BusinessKnowledgeDocumentListView({
  filters,
  onBack,
  onSelectDocument,
}: {
  filters: BusinessKnowledgeDocumentFilters;
  onBack: () => void;
  onSelectDocument: (doc: BusinessKnowledgeDocument) => void;
}) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['business-knowledge-document-list', filters, page],
    queryFn: () => businessKnowledgeDocumentsService.listFiltered(filters, page, PAGE_SIZE),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className={styles.formGrid}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.pageTitle}>All Documents</div>
          <div className={styles.pageSubtitle}>{data ? `${data.total} document(s)` : 'Loading…'}</div>
        </div>
        <Button type="button" variant="ghost" size="sm" leftIcon={<FiArrowLeft />} onClick={onBack}>
          Back
        </Button>
      </div>

      {isLoading || !data ? (
        <Skeleton height={280} />
      ) : data.items.length === 0 ? (
        <div className={styles.emptyState}>No documents match this selection.</div>
      ) : (
        <>
          {data.items.map((d) => (
            <div
              key={d._id}
              className={styles.faqRow}
              onClick={() => onSelectDocument(d)}
              style={{ cursor: 'pointer', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span>{d.title ?? d.originalFilename}</span>
                <span className={styles.pageSubtitle}>
                  {d.assetType.replace('_', ' ')} · {new Date(d.createdAt).toLocaleDateString()}
                </span>
              </div>
              <Badge variant={d.reviewStatus === 'reviewed' ? 'success' : 'warning'}>
                {d.reviewStatus === 'reviewed' ? 'Reviewed' : 'Needs review'}
              </Badge>
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
