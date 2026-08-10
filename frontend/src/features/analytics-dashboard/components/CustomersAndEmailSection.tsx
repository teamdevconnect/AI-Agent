import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { DateRangeControl, SectionCard, Skeleton, StatTile } from '@/components/ui';
import type { DateRange } from '@/components/ui';
import { FiAlertTriangle, FiCheckCircle, FiMail, FiPieChart, FiUserPlus } from 'react-icons/fi';
import { customerActivityService } from '@/services/customerActivityService';
import { emailIntelligenceService } from '@/services/emailIntelligenceService';
import { DealSplitDonut } from './DealSplitDonut';
import styles from '../analytics-dashboard.module.css';

// Reworked after live feedback: "New Customers" (month-scoped, via the
// page's MonthPicker) and "Emails Sent/Missed" (day-scoped, its own
// separate filter) used to describe two different time windows on the same
// tab — each number was independently correct for its own filter, but
// showing them side by side without a shared window read as inconsistent/
// "wrong". Now: ONE date-range filter for this whole tab (defaulting to
// Today, matching what the user actually asked to see), four headline
// stats sharing that exact window, with the fuller customer/email
// breakdowns available below for anyone who wants more detail.
export function CustomersAndEmailSection({
  onSelectSummary,
  onSelectIntent,
  onSelectIntentSent,
}: {
  onSelectSummary?: (kind: 'sent' | 'missed', from: string, to: string) => void;
  onSelectIntent?: (intent: string, label: string, from: string, to: string) => void;
  onSelectIntentSent?: (intent: string, label: string, from: string, to: string) => void;
}) {
  const today = dayjs().format('YYYY-MM-DD');
  const [range, setRange] = useState<DateRange>({ dateFrom: today, dateTo: today });
  const from = range.dateFrom ?? today;
  const to = range.dateTo ?? today;

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['analytics-dashboard-customer-breakdown', from, to],
    queryFn: () => customerActivityService.getBreakdownStats(from, to),
    refetchInterval: 60_000,
  });

  const { data: emailStats, isLoading: emailLoading } = useQuery({
    queryKey: ['analytics-dashboard-email-activity', from, to],
    queryFn: () => emailIntelligenceService.getActivityStats(from, to),
    refetchInterval: 60_000,
  });

  const loading = customersLoading || emailLoading || !customers || !emailStats;

  return (
    <div className={styles.tabContent}>
      <DateRangeControl value={range} onChange={setRange} />

      {loading ? (
        <Skeleton height={100} />
      ) : (
        <div className={styles.statsGrid}>
          <StatTile icon={FiUserPlus} value={customers.newCount} label="New Customers" />
          <StatTile
            icon={FiCheckCircle}
            value={emailStats.sentCount}
            label="Emails Sent"
            onClick={onSelectSummary ? () => onSelectSummary('sent', from, to) : undefined}
          />
          <StatTile
            icon={FiAlertTriangle}
            value={emailStats.missedCount}
            label="Missed Emails"
            onClick={onSelectSummary ? () => onSelectSummary('missed', from, to) : undefined}
          />
          <StatTile
            icon={FiMail}
            value={emailStats.newEnquiryCount}
            label="New Enquiries"
            onClick={onSelectIntent ? () => onSelectIntent('new_enquiry', 'New Enquiry', from, to) : undefined}
          />
        </div>
      )}

      <SectionCard title="Customer Mix" icon={FiPieChart}>
        {customersLoading || !customers ? (
          <Skeleton height={180} />
        ) : (
          <DealSplitDonut
            totalLabel="customers considered in this range"
            segments={[
              { key: 'new', label: 'New', value: customers.newCount, color: 'var(--color-success)' },
              { key: 'existing', label: 'Existing', value: customers.existingCount, color: 'var(--brand-accent-primary)' },
              { key: 'lost', label: 'Lost', value: customers.lostCount, color: 'var(--color-danger)' },
            ]}
          />
        )}
      </SectionCard>

      <SectionCard title="Inbox & Sent, by Category" icon={FiMail}>
        {emailLoading || !emailStats ? (
          <Skeleton height={180} />
        ) : (
          <table className={styles.categoryTable}>
            <thead>
              <tr>
                <th>Category</th>
                <th>Received</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {emailStats.byIntent.map((row) => (
                <tr key={row.intent}>
                  <td>{row.label}</td>
                  <td
                    className={onSelectIntent ? styles.categoryCellClickable : undefined}
                    onClick={onSelectIntent ? () => onSelectIntent(row.intent, row.label, from, to) : undefined}
                  >
                    {row.receivedCount}
                  </td>
                  <td
                    className={onSelectIntentSent ? styles.categoryCellClickable : undefined}
                    onClick={onSelectIntentSent ? () => onSelectIntentSent(row.intent, row.label, from, to) : undefined}
                  >
                    {row.sentCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
