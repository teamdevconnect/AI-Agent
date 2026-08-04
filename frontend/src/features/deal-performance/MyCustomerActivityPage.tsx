import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { FiBarChart2, FiClock, FiMail, FiUsers, FiXCircle } from 'react-icons/fi';
import { customerActivityService } from '@/services/customerActivityService';
import { StatTile } from '@/features/dashboard/components/StatTile';
import { SectionCard, Skeleton } from '@/components/ui';
import { CustomerActivityTable } from './components/CustomerActivityTable';
import { UnactionedList, LostReasonList, CorrelatedEmailList } from './components/CustomerActivityDigest';
import { CustomerActivitySummaryPanel } from './components/CustomerActivitySummaryPanel';
import styles from './deal-performance.module.css';

// Consultant-only personal equivalent of DealPerformancePage's Customer
// Activity tab — deliberately a separate, filter-less, tab-less page rather
// than opening ROUTES.dealPerformance itself to consultants (that page's
// other tabs/filters all call owner/admin/manager-only endpoints). Lives
// inside deal-performance/ so it can reuse every Customer Activity
// component and this module's CSS unmodified.
export function MyCustomerActivityPage() {
  const queryClient = useQueryClient();

  const { data, isFetching } = useQuery({
    queryKey: ['customer-activity-personal-overview'],
    queryFn: () => customerActivityService.getPersonalOverview(),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });

  const handleGenerateSummary = async (regenerate: boolean) => {
    const result = await customerActivityService.generatePersonalSummary(regenerate);
    queryClient.setQueryData(['customer-activity-personal-overview'], result);
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.pageTitle}>My Customer Activity</div>
          <div className={styles.pageSubtitle}>
            {data ? `${data.businessTable.length} customer(s) in your pipeline` : 'Loading…'}
          </div>
        </div>
      </div>

      {!data ? (
        <>
          <Skeleton height={100} />
          <Skeleton height={220} />
        </>
      ) : (
        <div className={clsx(styles.tabContent, isFetching && styles.fetching)}>
          <CustomerActivitySummaryPanel summary={data.summary} onGenerate={handleGenerateSummary} />

          <SectionCard title="Today's Snapshot" icon={FiBarChart2}>
            <div className={styles.statsGrid}>
              <StatTile value={data.totalActionedToday} label="Total Actioned Today" />
              <StatTile value={data.actionedTodayCounts.existing} label="Existing" />
              <StatTile value={data.actionedTodayCounts.new} label="New" />
              <StatTile value={data.actionedTodayCounts.followUp} label="Follow-ups" />
            </div>
          </SectionCard>

          <SectionCard title="Your Customers — Business Name & Quote Number" icon={FiUsers}>
            <CustomerActivityTable rows={data.businessTable} />
          </SectionCard>

          <div className={styles.twoColumn}>
            <SectionCard title="Left Unactioned" icon={FiClock}>
              <UnactionedList items={data.unactionedItems} />
            </SectionCard>
            <SectionCard title="Lost Deals — Reason" icon={FiXCircle}>
              <LostReasonList items={data.lostWithReason} />
            </SectionCard>
          </div>

          <SectionCard title={`Emails Correlated to Your Customers Today (${data.correlatedEmails.length})`} icon={FiMail}>
            <span className={styles.coverageNote}>{data.emailCorrelationCoverage.note}</span>
            <CorrelatedEmailList items={data.correlatedEmails} />
          </SectionCard>
        </div>
      )}
    </div>
  );
}
