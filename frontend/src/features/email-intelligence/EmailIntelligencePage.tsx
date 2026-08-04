import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/api/socketClient';
import { useAuthStore } from '@/stores/authStore';
import { SectionCard, Tabs } from '@/components/ui';
import { FiInbox } from 'react-icons/fi';
import { emailIntelligenceService, type EmailIntelligenceItem } from '@/services/emailIntelligenceService';
import { EmailIntelligenceList } from './components/EmailIntelligenceList';
import { EmailIntelligenceDetailModal } from './components/EmailIntelligenceDetailModal';
import styles from './email-intelligence.module.css';

const STATUS_TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

export function EmailIntelligencePage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [selected, setSelected] = useState<EmailIntelligenceItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['email-intelligence-items', status],
    queryFn: () => emailIntelligenceService.list(status),
    refetchInterval: 60_000,
  });

  // Real-time nudge: the scheduled poller notifies the mailbox owner via the
  // existing notification socket channel once a new item is analyzed — same
  // established pattern as FinancePage.tsx's identical listener, no new
  // WebSocket gateway needed.
  useEffect(() => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    const socket = getSocket(token);
    const handler = (n: { source?: string }) => {
      if (n.source === 'email-intelligence') {
        void queryClient.invalidateQueries({ queryKey: ['email-intelligence-items'] });
      }
    };
    socket.on('notification', handler);
    return () => {
      socket.off('notification', handler);
    };
  }, [queryClient]);

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.pageTitle}>AI Email Inbox</div>
          <div className={styles.pageSubtitle}>
            Your connected mailbox is scanned automatically — review, edit, and approve AI-drafted replies here.
          </div>
        </div>
      </div>

      <div className={styles.tabBar}>
        <Tabs items={STATUS_TABS} activeId={status} onChange={(id) => setStatus(id as typeof status)} />
      </div>

      <SectionCard title="Email Queue" icon={FiInbox}>
        <EmailIntelligenceList items={data} isLoading={isLoading} onSelect={setSelected} />
      </SectionCard>

      <EmailIntelligenceDetailModal
        open={!!selected}
        item={selected}
        onClose={() => setSelected(null)}
        onUpdated={(updated) => {
          // Keep the open modal showing the fresh item immediately (e.g. a
          // newly-set sentAt/sendError after Send) rather than stale data
          // until it's closed and reopened, on top of invalidating the list.
          setSelected(updated);
          void queryClient.invalidateQueries({ queryKey: ['email-intelligence-items'] });
        }}
      />
    </div>
  );
}
