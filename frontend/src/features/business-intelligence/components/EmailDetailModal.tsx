import { useQuery } from '@tanstack/react-query';
import { Badge, Modal, Skeleton } from '@/components/ui';
import { emailAnalyticsService } from '@/services/emailAnalyticsService';
import styles from '../business-intelligence.module.css';

// Shared detail modal for the Sent/Missed Email Analytics pages' full-list
// record browser — one implementation, so the two pages can never render
// this differently.
export function EmailDetailModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: item, isLoading } = useQuery({
    queryKey: ['bi-email-detail', id],
    queryFn: () => emailAnalyticsService.getOne(id!),
    enabled: !!id,
  });

  return (
    <Modal open={!!id} onClose={onClose} title={item?.subject || 'Email detail'} maxWidth={600}>
      <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {isLoading || !item ? (
          <Skeleton height={160} />
        ) : (
          <>
            <div className={styles.badgeRow}>
              <Badge variant="accent">{item.intent}</Badge>
              <Badge variant={item.priority === 'urgent' || item.priority === 'high' ? 'danger' : 'neutral'}>
                {item.priority} priority
              </Badge>
              <Badge variant="neutral">{item.status}</Badge>
              {item.sentAt && <Badge variant="success">Replied</Badge>}
            </div>
            <div>
              <div className={styles.sectionTitle}>From</div>
              <div>{item.matchedBusinessName ?? item.fromAddress}</div>
              <div className={styles.fadeCaption}>{item.fromAddress}</div>
            </div>
            <div>
              <div className={styles.sectionTitle}>Received</div>
              <div>{new Date(item.receivedAt).toLocaleString()}</div>
            </div>
            {item.sentAt && (
              <div>
                <div className={styles.sectionTitle}>Replied At</div>
                <div>{new Date(item.sentAt).toLocaleString()}</div>
              </div>
            )}
            <div>
              <div className={styles.sectionTitle}>Preview</div>
              <div className={styles.fadeCaption}>{item.bodyPreview || '(no preview available)'}</div>
            </div>
            {item.recommendedAction && (
              <div>
                <div className={styles.sectionTitle}>Recommended Action</div>
                <div>{item.recommendedAction}</div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
