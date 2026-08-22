import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FiAlertTriangle, FiMail, FiSend, FiUserPlus } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { Card, Skeleton } from '@/components/ui';
import { customerActivityService } from '@/services/customerActivityService';
import { emailAnalyticsService, type BiFilters } from '@/services/emailAnalyticsService';
import { CustomerMixCard } from './CustomerMixCard';
import { InboxIntentCard } from './InboxIntentCard';
import { PendingConversationsCard } from './PendingConversationsCard';
import styles from '../analytics-dashboard.module.css';
import statStyles from './CustomersAndEmailStats.module.css';

// Switching tabs and back within this window reuses the cached result
// instead of refiring the same request — these numbers don't move
// second-to-second, so there's no accuracy cost, only fewer redundant calls.
const STALE_TIME = 30_000;

function StatCard({ icon: Icon, label, value, note }: { icon: IconType; label: string; value: number; note: string }) {
  return (
    <Card className={statStyles.cell}>
      <span className={statStyles.iconBadge}>
        <Icon size={16} />
      </span>
      <div className={statStyles.label}>{label}</div>
      <div className={statStyles.value}>{value.toLocaleString()}</div>
      <div className={statStyles.note}>{note}</div>
    </Card>
  );
}

// Consolidated: this tab used to duplicate the same sent/missed/by-intent
// numbers in two places (a lighter version here, a fuller version on a
// separate "Email Analytics" tab) — collapsed into one real data source
// (emailAnalyticsService) so the stat tiles above can never disagree with
// that other tab. Customer Mix is unique to this tab (no BI equivalent) and
// stays as-is.
export function CustomersAndEmailSection({ dateFrom, dateTo, storeId }: { dateFrom: string; dateTo: string; storeId?: string }) {
  const filters: BiFilters = { dateFrom, dateTo, employeeId: [], storeId: storeId ? [storeId] : [] };

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['analytics-dashboard-customer-breakdown', dateFrom, dateTo],
    queryFn: () => customerActivityService.getBreakdownStats(dateFrom, dateTo),
    refetchInterval: 60_000,
    staleTime: STALE_TIME,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dash-email-summary', filters],
    queryFn: () => emailAnalyticsService.getSummary(filters),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME,
  });

  return (
    <div className={styles.tabContent}>
      {summaryLoading || !summary || customersLoading || !customers ? (
        <Skeleton height={100} />
      ) : (
        <div className={statStyles.grid}>
          <StatCard icon={FiUserPlus} label="New customers" value={customers.newCount} note="in this period" />
          <StatCard icon={FiSend} label="Replied emails" value={summary.sentCount} note={`of ${summary.sentCount + summary.missedCount} sent`} />
          <StatCard icon={FiAlertTriangle} label="Missed emails" value={summary.missedCount} note="24h+ overdue" />
          <StatCard icon={FiMail} label="New enquiries" value={summary.newEnquiryCount} note="awaiting triage" />
        </div>
      )}

      <div className={styles.twoColumn}>
        {customersLoading || !customers ? (
          <Skeleton height={280} />
        ) : (
          <CustomerMixCard
            newCount={customers.newCount}
            existingCount={customers.existingCount}
            lostCount={customers.lostCount}
            totalConsidered={customers.totalConsidered}
          />
        )}
        {summaryLoading || !summary ? <Skeleton height={280} /> : <InboxIntentCard byIntent={summary.byIntent} />}
      </div>

      <PendingConversationsCard dateFrom={dateFrom} dateTo={dateTo} storeId={storeId} />
    </div>
  );
}
