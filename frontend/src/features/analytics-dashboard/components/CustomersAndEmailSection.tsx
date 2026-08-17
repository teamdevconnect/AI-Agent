import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiAlertTriangle, FiMail, FiPieChart, FiSend, FiUserPlus } from 'react-icons/fi';
import { Button, Card, SectionCard, Skeleton, StatTile, Tabs } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { customerActivityService } from '@/services/customerActivityService';
import { emailAnalyticsService, type BiFilters } from '@/services/emailAnalyticsService';
import { EmailDetailModal } from '@/features/business-intelligence/components/EmailDetailModal';
import biStyles from '@/features/business-intelligence/business-intelligence.module.css';
import { DealSplitDonut } from './DealSplitDonut';
import styles from '../analytics-dashboard.module.css';

const PAGE_SIZE = 20;
// Switching tabs and back within this window reuses the cached result
// instead of refiring the same request — these numbers don't move
// second-to-second, so there's no accuracy cost, only fewer redundant calls.
const STALE_TIME = 30_000;
const LIST_TABS = [
  { id: 'sent', label: 'Sent' },
  { id: 'missed', label: 'Missed' },
  { id: 'all', label: 'All' },
];

// Consolidated: this tab used to duplicate the same sent/missed/by-intent
// numbers in two places (a lighter version here, a fuller version on a
// separate "Email Analytics" tab) — collapsed into one real data source
// (emailAnalyticsService, the same endpoint the by-employee/full-list/
// export/detail-modal views below also use) so the stat tiles and this
// tab's own drill-down list can never disagree. Customer Mix is unique to
// this tab (no BI equivalent) and stays as-is.
export function CustomersAndEmailSection({ dateFrom, dateTo, storeId }: { dateFrom: string; dateTo: string; storeId?: string }) {
  const filters: BiFilters = { dateFrom, dateTo, employeeId: [], storeId: storeId ? [storeId] : [] };
  const [listKind, setListKind] = useState<'sent' | 'missed' | 'all'>('sent');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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

  const { data: sentByEmployee, isLoading: sentByEmployeeLoading } = useQuery({
    queryKey: ['dash-email-by-employee-sent', filters],
    queryFn: () => emailAnalyticsService.getByEmployee('sent', filters),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME,
  });
  const { data: missedByEmployee, isLoading: missedByEmployeeLoading } = useQuery({
    queryKey: ['dash-email-by-employee-missed', filters],
    queryFn: () => emailAnalyticsService.getByEmployee('missed', filters),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME,
  });

  const { data: list, isLoading: listLoading } = useQuery({
    queryKey: ['dash-email-list', filters, listKind, page],
    queryFn: () => emailAnalyticsService.listEmails(listKind, filters, page, PAGE_SIZE),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME,
  });

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      await emailAnalyticsService.downloadExport(listKind, filters, format);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const employeeRows = new Map<string, { userName: string; sent: number; missed: number; urgentHigh: number; b24: number; b48: number; b72: number }>();
  for (const r of sentByEmployee?.rows ?? []) {
    employeeRows.set(r.userId, { userName: r.userName, sent: r.count, missed: 0, urgentHigh: 0, b24: 0, b48: 0, b72: 0 });
  }
  for (const r of missedByEmployee?.rows ?? []) {
    const existing = employeeRows.get(r.userId) ?? { userName: r.userName, sent: 0, missed: 0, urgentHigh: 0, b24: 0, b48: 0, b72: 0 };
    existing.missed = r.count;
    existing.urgentHigh = (r.byPriority ?? []).filter((p) => p.value === 'urgent' || p.value === 'high').reduce((s, p) => s + p.count, 0);
    const buckets = new Map((r.ageBuckets ?? []).map((b) => [b.bucket, b.count]));
    existing.b24 = buckets.get('24-48h') ?? 0;
    existing.b48 = buckets.get('48-72h') ?? 0;
    existing.b72 = buckets.get('72h+') ?? 0;
    employeeRows.set(r.userId, existing);
  }

  return (
    <div className={styles.tabContent}>
      {summaryLoading || !summary || customersLoading || !customers ? (
        <Skeleton height={100} />
      ) : (
        <div className={styles.statsGrid}>
          <StatTile icon={FiUserPlus} value={customers.newCount} label="New Customers" />
          <StatTile icon={FiSend} value={summary.sentCount} label="Sent (Replied)" />
          <StatTile icon={FiAlertTriangle} value={summary.missedCount} label="Missed (24h+ Overdue)" />
          <StatTile icon={FiMail} value={summary.newEnquiryCount} label="New Enquiries" />
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

      <SectionCard title="By Intent (Received vs. Replied)" icon={FiMail}>
        {summaryLoading || !summary ? (
          <Skeleton height={140} />
        ) : (
          <div className={biStyles.tableWrapper}>
            <table className={biStyles.table}>
              <thead>
                <tr>
                  <th>Intent</th>
                  <th>Received</th>
                  <th>Replied</th>
                </tr>
              </thead>
              <tbody>
                {summary.byIntent.map((row) => (
                  <tr key={row.intent}>
                    <td>{row.label}</td>
                    <td>{row.receivedCount}</td>
                    <td>{row.sentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="By Employee — Sent vs. Missed">
        {sentByEmployeeLoading || missedByEmployeeLoading ? (
          <Skeleton height={140} />
        ) : employeeRows.size === 0 ? (
          <div className={styles.emptyState}>No eligible employees in scope for this period.</div>
        ) : (
          <div className={biStyles.tableWrapper}>
            <table className={biStyles.table}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Sent</th>
                  <th>Missed</th>
                  <th>Urgent/High</th>
                  <th>24-48h</th>
                  <th>48-72h</th>
                  <th>72h+</th>
                </tr>
              </thead>
              <tbody>
                {[...employeeRows.values()].map((r) => (
                  <tr key={r.userName}>
                    <td>{r.userName}</td>
                    <td>{r.sent}</td>
                    <td>{r.missed}</td>
                    <td>{r.urgentHigh}</td>
                    <td>{r.b24}</td>
                    <td>{r.b48}</td>
                    <td>{r.b72}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Full List"
        action={
          <div className={biStyles.formRow}>
            <Tabs
              items={LIST_TABS}
              activeId={listKind}
              onChange={(id) => {
                setListKind(id as 'sent' | 'missed' | 'all');
                setPage(1);
              }}
            />
            <Button size="sm" variant="ghost" loading={exporting} onClick={() => void handleExport('csv')}>
              Export CSV
            </Button>
          </div>
        }
      >
        {listLoading || !list ? (
          <Skeleton height={200} />
        ) : list.items.length === 0 ? (
          <div className={styles.emptyState}>No emails match the current filters.</div>
        ) : (
          <>
            {list.items.map((item) => (
              <Card key={item._id} interactive className={styles.listItem} onClick={() => setSelectedId(item._id)} style={{ marginBottom: 8 }}>
                <div className={styles.listItemMain}>
                  <span className={styles.listItemTitle}>{item.subject || '(no subject)'}</span>
                  <span className={styles.listItemMeta}>
                    {item.matchedBusinessName ?? item.fromAddress} · {item.intent} · {new Date(item.receivedAt).toLocaleString()}
                  </span>
                </div>
              </Card>
            ))}
            <div className={biStyles.pagination}>
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span>
                Page {list.page} of {Math.max(1, Math.ceil(list.total / list.pageSize))} ({list.total} total)
              </span>
              <Button size="sm" variant="ghost" disabled={page * PAGE_SIZE >= list.total} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </>
        )}
      </SectionCard>

      <EmailDetailModal id={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
