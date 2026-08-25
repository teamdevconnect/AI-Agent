import { dayjs } from '@/utils/date';
import { formatINR as money } from '@/utils/currency';
import type { SalesReportSummary } from '@/services/salesReportService';
import styles from '../reporting.module.css';

const GROUP_LABEL: Record<string, string> = { customer: 'Customer', user: 'User', quoteOwner: 'Quote Owner' };

export function SalesReportView({ report }: { report: SalesReportSummary }) {
  const groupLabel = GROUP_LABEL[report.groupBy];

  return (
    <>
      <div className={styles.reportTitle}>{`Sales Report – Sales Per ${groupLabel}`}</div>
      <div className={styles.reportDescription}>
        This report tallies won-deal revenue within the selected date range, grouped by {groupLabel.toLowerCase()}.
        {' '}
        {report.dataSourceNote}
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
          <tr className={styles.totalRow}>
            <td>Total Sales for Period</td>
            <td>{money(report.totalSalesForPeriod)}</td>
          </tr>
        </tbody>
      </table>

      <div className={styles.sectionHeading}>Details</div>
      {report.groups.length === 0 ? (
        <div className={styles.emptyState}>No won deals in this date range.</div>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.reportTable}>
            <thead>
              <tr>
                <th>{groupLabel}</th>
                <th>Total ($) (Ex Tax)</th>
                <th>% of Sales</th>
              </tr>
            </thead>
            <tbody>
              {report.groups.map((g) => (
                <tr key={g.groupKey}>
                  <td>{g.groupLabel}</td>
                  <td>{money(g.totalSalesExTax)}</td>
                  <td>{g.percentOfSales}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
