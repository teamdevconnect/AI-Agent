import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { customerActivityService } from '@/services/customerActivityService';
import { StatTile } from '@/features/dashboard/components/StatTile';
import { Skeleton } from '@/components/ui';
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
        <div className={clsx(styles.section, isFetching && styles.fetching)}>
          <CustomerActivitySummaryPanel summary={data.summary} onGenerate={handleGenerateSummary} />

          <div className={styles.statsGrid}>
            <StatTile value={data.totalActionedToday} label="Total Actioned Today" />
            <StatTile value={data.actionedTodayCounts.existing} label="Existing" />
            <StatTile value={data.actionedTodayCounts.new} label="New" />
            <StatTile value={data.actionedTodayCounts.followUp} label="Follow-ups" />
          </div>

          <div className={styles.section}>
            <span className={styles.sectionTitle}>Your Customers — Business Name &amp; Quote Number</span>
            <CustomerActivityTable rows={data.businessTable} />
          </div>

          <div className={styles.twoColumn}>
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Left Unactioned</span>
              <UnactionedList items={data.unactionedItems} />
            </div>
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Lost Deals — Reason</span>
              <LostReasonList items={data.lostWithReason} />
            </div>
          </div>

          <div className={styles.section}>
            <span className={styles.sectionTitle}>Emails Correlated to Your Customers Today ({data.correlatedEmails.length})</span>
            <span className={styles.coverageNote}>{data.emailCorrelationCoverage.note}</span>
            <CorrelatedEmailList items={data.correlatedEmails} />
          </div>
        </div>
      )}
    </div>
  );
}
