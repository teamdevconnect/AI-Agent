import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiDollarSign, FiTrendingUp, FiZap } from 'react-icons/fi';
import { Badge, Button, SectionCard, Skeleton, StatTile } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { formatINR as money } from '@/utils/currency';
import { vendorProfitabilityService, type VendorCustomerCompareResult } from '@/services/vendorProfitabilityService';
import { ManageVendorsModal } from '@/features/business-intelligence/components/ManageVendorsModal';
import biStyles from '@/features/business-intelligence/business-intelligence.module.css';
import styles from '../analytics-dashboard.module.css';

// Business Intelligence section 5 — Accounts Receivable & Vendor
// Profitability. This tab is only rendered for owner/admin (see
// AnalyticsDashboardPage's own tab-visibility filter) — margin data is more
// sensitive than pipeline data. No Net Profit column — Gross Profit only.
export function VendorProfitabilitySection({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [manageOpen, setManageOpen] = useState(false);
  const [aiResult, setAiResult] = useState<VendorCustomerCompareResult | null>(null);
  const filters = { dateFrom, dateTo };

  const { data, isLoading } = useQuery({
    queryKey: ['dash-vendor-profitability', filters],
    queryFn: () => vendorProfitabilityService.getOverview(filters),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const aiCompare = useMutation({
    mutationFn: () => vendorProfitabilityService.requestAiComparison(filters),
    onSuccess: (result) => setAiResult(result),
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  return (
    <div className={styles.tabContent}>
      <div className={styles.headerActions} style={{ justifyContent: 'flex-end' }}>
        <Button size="sm" variant="secondary" onClick={() => setManageOpen(true)}>
          Manage Vendors
        </Button>
      </div>

      {data && data.coveragePct !== null && data.coveragePct < 100 && (
        <div className={biStyles.coverageNote}>
          {data.coveragePct}% of deals with a vendor invoice in this range have that cost fully/partially paid.
        </div>
      )}
      {data && data.currencyMismatchCount > 0 && (
        <div className={biStyles.coverageNote}>
          {data.currencyMismatchCount} transaction(s) have mismatched currencies — flagged below and excluded from totals.
        </div>
      )}

      {isLoading || !data ? (
        <Skeleton height={100} />
      ) : (
        <div className={styles.statsGrid}>
          <StatTile icon={FiDollarSign} value={money(data.totals.customerRevenue)} label="Customer Revenue" />
          <StatTile icon={FiDollarSign} value={money(data.totals.vendorCost)} label="Vendor Cost (Paid)" />
          <StatTile icon={FiTrendingUp} value={money(data.totals.grossProfit)} label="Gross Profit" />
          <StatTile value={data.totals.grossMarginPct !== null ? `${data.totals.grossMarginPct}%` : '—'} label="Gross Margin" />
        </div>
      )}

      <SectionCard
        title="Transactions"
        action={
          <Button size="sm" variant="ghost" loading={aiCompare.isPending} onClick={() => aiCompare.mutate()}>
            <FiZap size={13} /> AI Compare
          </Button>
        }
      >
        {isLoading || !data ? (
          <Skeleton height={220} />
        ) : data.rows.length === 0 ? (
          <div className={styles.emptyState}>
            No transactions with a linked, paid vendor cost in this range yet — link a Vendor Quote/Payment to a Deal to see it here.
          </div>
        ) : (
          <div className={biStyles.tableWrapper}>
            <table className={biStyles.table}>
              <thead>
                <tr>
                  <th>Deal</th>
                  <th>Vendor(s)</th>
                  <th>Vendor Cost</th>
                  <th>Customer Revenue</th>
                  <th>Customer Paid</th>
                  <th>Gross Profit</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.dealId}>
                    <td>{r.dealName ?? r.dealId}</td>
                    <td>{r.vendorNames.join(', ') || '—'}</td>
                    <td>
                      {money(r.vendorCost)} {r.vendorCostCurrency !== 'INR' ? r.vendorCostCurrency : ''}
                    </td>
                    <td>
                      {money(r.customerRevenue)} {r.customerRevenueCurrency !== 'INR' ? r.customerRevenueCurrency : ''}
                    </td>
                    <td>{money(r.customerPaid)}</td>
                    <td>{r.currencyMismatch ? <Badge variant="warning">Currency mismatch</Badge> : money(r.grossProfit ?? 0)}</td>
                    <td>{r.grossMarginPct !== null ? `${r.grossMarginPct}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {aiResult && (
        <div className={biStyles.aiSummaryCard}>
          <span className={biStyles.aiInsightLabel}>
            <FiZap size={14} /> AI Pricing Comparison
          </span>
          <span className={biStyles.aiInsightText}>{aiResult.aggregateNarrative}</span>
          {aiResult.flaggedTransactions.length > 0 && (
            <div className={biStyles.section}>
              <span className={biStyles.sectionTitle}>Flagged for Review</span>
              {aiResult.flaggedTransactions.map((f) => (
                <div key={f.dealId} className={biStyles.listItem}>
                  <div className={biStyles.listItemMain}>
                    <span className={biStyles.listItemTitle}>{data?.rows.find((r) => r.dealId === f.dealId)?.dealName ?? f.dealId}</span>
                    <span className={biStyles.listItemMeta}>{f.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {aiResult.transactionNotes.length > 0 && (
            <div className={biStyles.section}>
              <span className={biStyles.sectionTitle}>Transaction Notes</span>
              {aiResult.transactionNotes.map((n) => (
                <div key={n.dealId} className={biStyles.listItem}>
                  <div className={biStyles.listItemMain}>
                    <span className={biStyles.listItemTitle}>{data?.rows.find((r) => r.dealId === n.dealId)?.dealName ?? n.dealId}</span>
                    <span className={biStyles.listItemMeta}>{n.commentary}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ManageVendorsModal open={manageOpen} onClose={() => setManageOpen(false)} />
    </div>
  );
}
