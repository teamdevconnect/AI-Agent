import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FiCheckCircle, FiHelpCircle, FiXCircle } from 'react-icons/fi';
import { Badge, SectionCard, Skeleton, StatTile } from '@/components/ui';
import { formatINR as money } from '@/utils/currency';
import { enquiryConversionService } from '@/services/enquiryConversionService';
import biStyles from '@/features/business-intelligence/business-intelligence.module.css';
import styles from '../analytics-dashboard.module.css';

const MATCH_BADGE: Record<string, { variant: 'success' | 'warning' | 'neutral'; label: string }> = {
  exact: { variant: 'success', label: 'Exact' },
  inferred: { variant: 'warning', label: 'Inferred' },
  unmatched: { variant: 'neutral', label: 'Unmatched' },
};

// Business Intelligence section 4 — Email Enquiry -> Quote Conversion.
// exactCount/inferredCount/unmatchedCount always shown as three separate
// numbers, never blended into one "conversion rate".
export function EnquiryConversionSection({ dateFrom, dateTo, storeId }: { dateFrom: string; dateTo: string; storeId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['dash-enquiry-conversion', dateFrom, dateTo, storeId],
    queryFn: () => enquiryConversionService.getOverview({ dateFrom, dateTo, employeeId: [], storeId: storeId ? [storeId] : [] }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  return (
    <div className={styles.tabContent}>
      {isLoading || !data ? (
        <Skeleton height={100} />
      ) : (
        <div className={styles.statsGrid}>
          <StatTile icon={FiCheckCircle} value={data.exactCount} label="Exact Match" />
          <StatTile icon={FiHelpCircle} value={data.inferredCount} label="Inferred Match" />
          <StatTile icon={FiXCircle} value={data.unmatchedCount} label="Unmatched" />
        </div>
      )}

      <SectionCard title="Enquiries">
        {isLoading || !data ? (
          <Skeleton height={220} />
        ) : data.rows.length === 0 ? (
          <div className={styles.emptyState}>No enquiry/quotation-request emails in this range.</div>
        ) : (
          <div className={biStyles.tableWrapper}>
            <table className={biStyles.table}>
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Subject</th>
                  <th>From</th>
                  <th>Match</th>
                  <th>Quote</th>
                  <th>Quote Status</th>
                  <th>Quote Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const badge = MATCH_BADGE[r.matchType];
                  return (
                    <tr key={r.emailItemId}>
                      <td>{new Date(r.receivedAt).toLocaleDateString()}</td>
                      <td>{r.subject || '(no subject)'}</td>
                      <td>{r.matchedBusinessName ?? r.fromAddress}</td>
                      <td>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td>{r.quote?.quoteNumber ?? '—'}</td>
                      <td>{r.quote?.clientApprovalStatus ?? '—'}</td>
                      <td>{r.quote ? money(r.quote.quoteAmount) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
