import { dayjs } from '@/utils/date';
import { formatINR } from '@/utils/currency';
import type { GrossMarginReportSummary } from '@/services/grossMarginReportService';
import styles from '../reporting.module.css';

// groupBy is "metric + dimension" combined (matches the reference report's
// 4 radios: Sales/Quotes crossed with Customer/User) — split back apart
// here purely for display.
const METRIC_LABEL: Record<string, string> = { sales: 'Sales', quotes: 'Quotes' };

function splitGroupBy(groupBy: string): { metric: string; dimension: 'Customer' | 'User' } {
  const metric = groupBy.startsWith('sales') ? 'sales' : 'quotes';
  const dimension = groupBy.endsWith('Customer') ? 'Customer' : 'User';
  return { metric, dimension };
}

// Renders real numbers once `hasCostData` is true (computed from
// Invoice.costAmount — a manually-entered field, see the Royalty Invoices
// edit form's "Cost" input). Otherwise shows `report.note` as an honest
// empty state instead of a fabricated $0.00/100% table, matching this app's
// established "never fabricate a financial figure" convention.
export function GrossMarginReportView({ report }: { report: GrossMarginReportSummary }) {
  const { metric, dimension } = splitGroupBy(report.groupBy);
  const metricLabel = METRIC_LABEL[metric];
  const dimensionLabel = dimension;

  return (
    <>
      <div className={styles.reportTitle}>{`Gross Margin Report – ${metricLabel} Per ${dimensionLabel}`}</div>
      <div className={styles.reportDescription}>
        Cost vs. income for {metricLabel.toLowerCase()} within the selected date range, grouped by{' '}
        {dimensionLabel.toLowerCase()}.
      </div>

      <div className={styles.sectionHeading}>Summary</div>
      <table className={styles.reportTable}>
        <tbody>
          <tr>
            <td>Report Date Range</td>
            <td>
              {dayjs(report.dateFrom).format('D MMM YYYY')} to {dayjs(report.dateTo).format('D MMM YYYY')}
            </td>
          </tr>
          {report.hasCostData && (
            <>
              <tr>
                <td>Invoice Coverage</td>
                <td>
                  {report.invoicesWithCost} of {report.totalInvoicesInRange} invoice(s) have a Cost entered ({report.coveragePct}%)
                </td>
              </tr>
              <tr>
                <td>Total Cost</td>
                <td>{formatINR(report.totalCost)}</td>
              </tr>
              <tr>
                <td>Total Income</td>
                <td>{formatINR(report.totalIncome)}</td>
              </tr>
              <tr className={styles.totalRow}>
                <td>Gross Margin</td>
                <td>
                  {formatINR(report.marginAmount)} ({report.marginPct}%)
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      {!report.hasCostData && <div className={styles.emptyState}>{report.note}</div>}

      {report.hasCostData && (
        <>
          <div className={styles.sectionHeading}>Details</div>
          <div className={styles.reportDescription}>{report.note}</div>
          <div className={styles.tableScroll}>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th>{dimensionLabel === 'Customer' ? 'Customer' : 'User'}</th>
                  <th>Total Cost</th>
                  <th>Total Income</th>
                  <th>Gross Margin ($)</th>
                  <th>Gross Margin (%)</th>
                </tr>
              </thead>
              <tbody>
                {report.groups.map((row) => (
                  <tr key={row.groupKey}>
                    <td>{row.groupLabel}</td>
                    <td>{formatINR(row.totalCost)}</td>
                    <td>{formatINR(row.totalIncome)}</td>
                    <td>{formatINR(row.marginAmount)}</td>
                    <td>{row.marginPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
