import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/api/socketClient';
import { useAuthStore } from '@/stores/authStore';
import { DateRangeControl, MultiSelectDropdown, SectionCard, Tabs } from '@/components/ui';
import type { DateRange } from '@/components/ui';
import { FiClock, FiInbox } from 'react-icons/fi';
import {
  EMAIL_INTELLIGENCE_INTENTS,
  emailIntelligenceService,
  RELEVANT_EMAIL_INTENTS,
  type EmailIntelligenceItem,
} from '@/services/emailIntelligenceService';
import { EmailIntelligenceList } from './components/EmailIntelligenceList';
import { EmailIntelligenceDetailModal } from './components/EmailIntelligenceDetailModal';
import { FollowUpsSection } from './components/FollowUpsSection';
import styles from './email-intelligence.module.css';

const STATUS_TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

function intentOptionLabel(intent: string): string {
  return intent
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

// One real, visible filter control instead of the old unlabeled "Relevant/
// All" tab pair — same underlying allow-list as the previous default
// (customer/enquiry/vendor-type mail), but now user-adjustable per intent
// rather than a fixed binary. An empty selection means "no filter" (show
// everything), matching every other MultiSelectDropdown filter in this app
// (Deal Performance/Finance/Timeline) — never "show nothing".
const INTENT_FILTER_OPTIONS = EMAIL_INTELLIGENCE_INTENTS.map((intent) => ({ value: intent, label: intentOptionLabel(intent) }));

export function EmailIntelligencePage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [intentFilter, setIntentFilter] = useState<string[]>([...RELEVANT_EMAIL_INTENTS]);
  const [range, setRange] = useState<DateRange>({});
  const [selected, setSelected] = useState<EmailIntelligenceItem | null>(null);

  // Date range is applied server-side (real receivedAt filtering, not just
  // hiding rows from an already-fetched page); Mail Type stays client-side
  // over that date-bounded set, same split TimelinePage.tsx already uses.
  const { data, isLoading } = useQuery({
    queryKey: ['email-intelligence-items', status, range],
    queryFn: () => emailIntelligenceService.list(status, { from: range.dateFrom, to: range.dateTo }),
    refetchInterval: 60_000,
  });

  const visibleItems = data?.filter((item) => intentFilter.length === 0 || intentFilter.includes(item.intent));

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

      <div className={styles.filterRow}>
        <DateRangeControl value={range} onChange={setRange} />
        <MultiSelectDropdown label="Mail Type" options={INTENT_FILTER_OPTIONS} selected={intentFilter} onChange={setIntentFilter} />
      </div>

      <SectionCard
        title="Email Queue"
        icon={FiInbox}
        action={
          data && visibleItems && data.length > visibleItems.length ? (
            <span className={styles.listItemMeta}>{visibleItems.length} of {data.length} shown</span>
          ) : undefined
        }
      >
        <EmailIntelligenceList items={visibleItems} isLoading={isLoading} onSelect={setSelected} />
      </SectionCard>

      <SectionCard title="Follow-ups" icon={FiClock}>
        <FollowUpsSection />
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
