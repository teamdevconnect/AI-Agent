import { useState } from 'react';
import type { ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FiAlertTriangle, FiMail, FiSend, FiUserPlus } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { Card, Skeleton, InfoPopover } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { hasRole } from '@/utils/roles';
import { customerActivityService } from '@/services/customerActivityService';
import { emailAnalyticsService, type BiFilters } from '@/services/emailAnalyticsService';
import { EmailDetailModal } from '@/features/business-intelligence/components/EmailDetailModal';
import { CustomerMixCard } from './CustomerMixCard';
import { InboxIntentCard } from './InboxIntentCard';
import { PendingConversationsCard } from './PendingConversationsCard';
import { DrillDownModal, type DrillDownRow } from './DrillDownModal';
import styles from '../analytics-dashboard.module.css';
import statStyles from './CustomersAndEmailStats.module.css';

// Switching tabs and back within this window reuses the cached result
// instead of refiring the same request — these numbers don't move
// second-to-second, so there's no accuracy cost, only fewer redundant calls.
const STALE_TIME = 30_000;

type CustomerCategory = 'new' | 'existing' | 'lost';

const CATEGORY_TITLES: Record<CustomerCategory, string> = {
  new: 'New Customers',
  existing: 'Existing Customers',
  lost: 'Lost Customers',
};

function StatCard({
  icon: Icon,
  label,
  value,
  note,
  onClick,
  info,
}: {
  icon: IconType;
  label: string;
  value: number;
  note: string;
  onClick?: () => void;
  info?: ReactNode;
}) {
  return (
    <Card className={statStyles.cell} interactive={!!onClick} onClick={onClick}>
      <span className={statStyles.iconBadge}>
        <Icon size={16} />
      </span>
      <div className={statStyles.label}>
        {label}
        {info && <InfoPopover title={label}>{info}</InfoPopover>}
      </div>
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
  const user = useAuthStore((s) => s.user);
  // Mirrors customer-activity.controller.ts's breakdown-stats branching:
  // owner/admin/manager get the org/store-scoped relationship endpoint,
  // everyone else (consultant) is forced onto the self-scoped one.
  const isPersonalScope = !hasRole(user, 'owner') && !hasRole(user, 'admin') && !hasRole(user, 'manager');

  // Drives the New/Existing/Lost/Missed popups — set by clicking a
  // CustomerMixCard segment or the Missed emails stat tile. Only one can be
  // open at a time, so a single piece of state is enough.
  const [activeCategory, setActiveCategory] = useState<CustomerCategory | 'missed' | null>(null);
  // Second level for a New/Existing/Lost row — that business's own
  // correlated emails, fetched on demand rather than bundled into the
  // breakdown response (which would fetch relationship data for every
  // business up front, most of which nobody ever opens).
  const [selectedBusiness, setSelectedBusiness] = useState<{ key: string; businessName: string } | null>(null);
  // Third level for a Missed-email row — the real EmailDetailModal, reused
  // as-is from Business Intelligence so the two surfaces can never render
  // an email's detail differently.
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

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

  const { data: missedEmails, isLoading: missedLoading } = useQuery({
    queryKey: ['dash-missed-emails-list', filters],
    queryFn: () => emailAnalyticsService.listEmails('missed', filters, 1, 100),
    enabled: activeCategory === 'missed',
  });

  const { data: businessDetail, isLoading: businessDetailLoading } = useQuery({
    queryKey: ['dash-business-relationship', selectedBusiness?.key, isPersonalScope],
    queryFn: () =>
      isPersonalScope
        ? customerActivityService.getPersonalRelationshipView(selectedBusiness!.key)
        : customerActivityService.getRelationshipView(selectedBusiness!.key),
    enabled: !!selectedBusiness,
  });

  const categoryItems: Record<CustomerCategory, { key: string; businessName: string }[]> = {
    new: customers?.newItems ?? [],
    existing: customers?.existingItems ?? [],
    lost: customers?.lostItems ?? [],
  };

  const categoryRows: DrillDownRow[] =
    activeCategory && activeCategory !== 'missed'
      ? categoryItems[activeCategory].map((item) => ({ id: item.key, title: item.businessName }))
      : [];

  const missedRows: DrillDownRow[] = (missedEmails?.items ?? []).map((item) => ({
    id: item._id,
    title: item.subject || '(no subject)',
    subtitle: item.matchedBusinessName ?? item.fromAddress,
    meta: new Date(item.receivedAt).toLocaleString(),
  }));

  const correlatedEmailRows: DrillDownRow[] = (businessDetail?.correlatedEmails ?? []).map((email) => ({
    id: email.id,
    title: email.subject || '(no subject)',
    subtitle: email.preview,
    meta: new Date(email.receivedAt).toLocaleString(),
  }));

  return (
    <div className={styles.tabContent}>
      {summaryLoading || !summary || customersLoading || !customers ? (
        <Skeleton height={100} />
      ) : (
        <div className={statStyles.grid}>
          <StatCard
            icon={FiUserPlus}
            label="New customers"
            value={customers.newCount}
            note="in this period"
            onClick={() => setActiveCategory('new')}
            info={<p>Businesses whose earliest deal or quote was created in this period. Click to see the list.</p>}
          />
          <StatCard
            icon={FiSend}
            label="Replied emails"
            value={summary.sentCount}
            note={`of ${summary.sentCount + summary.missedCount} sent`}
            info={<p>Relevant inbound emails in this period that received a reply, out of the total relevant emails received (replied + missed).</p>}
          />
          <StatCard
            icon={FiAlertTriangle}
            label="Missed emails"
            value={summary.missedCount}
            note="24h+ overdue"
            onClick={() => setActiveCategory('missed')}
            info={<p>Relevant emails still awaiting a reply more than 24 hours after they were received. Click to see the list and open any email.</p>}
          />
          <StatCard
            icon={FiMail}
            label="New enquiries"
            value={summary.newEnquiryCount}
            note="awaiting triage"
            info={<p>Emails the AI classified with intent "new enquiry" in this period — first-contact interest from a prospect, not yet actioned.</p>}
          />
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
            onSegmentClick={setActiveCategory}
          />
        )}
        {summaryLoading || !summary ? <Skeleton height={280} /> : <InboxIntentCard byIntent={summary.byIntent} />}
      </div>

      <PendingConversationsCard dateFrom={dateFrom} dateTo={dateTo} storeId={storeId} />

      <DrillDownModal
        open={activeCategory === 'missed'}
        onClose={() => setActiveCategory(null)}
        title="Missed Emails"
        isLoading={missedLoading}
        rows={missedRows}
        onRowClick={(row) => setSelectedEmailId(row.id)}
      />

      <DrillDownModal
        open={!!activeCategory && activeCategory !== 'missed'}
        onClose={() => setActiveCategory(null)}
        title={activeCategory && activeCategory !== 'missed' ? CATEGORY_TITLES[activeCategory] : ''}
        isLoading={false}
        rows={categoryRows}
        onRowClick={(row) => setSelectedBusiness({ key: row.id, businessName: row.title })}
      />

      <DrillDownModal
        open={!!selectedBusiness}
        onClose={() => setSelectedBusiness(null)}
        title={selectedBusiness ? `Emails — ${selectedBusiness.businessName}` : ''}
        isLoading={businessDetailLoading}
        rows={correlatedEmailRows}
      />

      <EmailDetailModal id={selectedEmailId} onClose={() => setSelectedEmailId(null)} />
    </div>
  );
}
