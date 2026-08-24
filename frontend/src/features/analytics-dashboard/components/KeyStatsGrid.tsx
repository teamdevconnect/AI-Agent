import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui';
import { formatINR as money } from '@/utils/currency';
import { dealsService } from '@/services/dealsService';
import { customerQuotePaymentService } from '@/services/customerQuotePaymentService';
import styles from './KeyStatsGrid.module.css';

const BUCKET_LABELS: Record<string, string> = {
  noDueDate: 'no due date',
  current: 'current',
  '1-30': '1–30 days overdue',
  '31-60': '31–60 days overdue',
  '60+': '60+ days overdue',
};

function describeBuckets(buckets: { bucket: string; amount: number }[], total: number): string {
  const top = [...buckets].filter((b) => b.amount > 0).sort((a, b) => b.amount - a.amount)[0];
  if (!top || total <= 0) return 'Nothing outstanding right now.';
  const label = BUCKET_LABELS[top.bucket] ?? top.bucket;
  const pct = Math.round((top.amount / total) * 100);
  return pct >= 95 ? `All in the ${label} bucket` : `${pct}% in the ${label} bucket`;
}

export interface KeyStatsGridProps {
  deals: { wonCount: number; lostCount: number; openCount: number };
  businessHealthScore: number | null;
  revenueTrend: { period: string; achieved: number }[];
  dateFrom: string;
  dateTo: string;
  storeId?: string;
  onDealsClick?: () => void;
}

// Deals Won / Conversion / Business Health mirror data the Overview tab
// already fetches (AnalyticsDashboardOverview.deals/revenue/revenueTrend) —
// Outstanding and the overdue/pending split under Deals Won are the two sub-
// figures that don't exist in that payload, so this fetches its own two
// small real datasets (same real endpoints the Pipeline & Quotes and
// Customers & Email tabs already use) rather than inventing numbers.
export function KeyStatsGrid({ deals, businessHealthScore, revenueTrend, dateFrom, dateTo, storeId, onDealsClick }: KeyStatsGridProps) {
  const { data: openDeals } = useQuery({
    queryKey: ['analytics-open-deals-aging', dateFrom, dateTo, storeId],
    queryFn: () =>
      dealsService.listFiltered(
        { dealStatus: ['open'], dateFrom, dateTo, dateField: 'expectedClosingDate', ...(storeId ? { storeId: [storeId] } : {}) },
        1,
        100,
      ),
  });

  const { data: paymentSummary } = useQuery({
    queryKey: ['analytics-quote-payment-summary', dateFrom, dateTo, storeId],
    queryFn: () => customerQuotePaymentService.getSummary({ dateFrom, dateTo, ...(storeId ? { storeId: [storeId] } : {}) }),
  });

  const { overdueCount, pendingCount } = useMemo(() => {
    if (!openDeals) return { overdueCount: 0, pendingCount: 0 };
    const today = dayjs().format('YYYY-MM-DD');
    let overdue = 0;
    for (const d of openDeals.items) {
      if (d.expectedClosingDate && d.expectedClosingDate < today) overdue += 1;
    }
    return { overdueCount: overdue, pendingCount: openDeals.items.length - overdue };
  }, [openDeals]);

  const totalDeals = deals.wonCount + deals.lostCount + deals.openCount;
  const closedDeals = deals.wonCount + deals.lostCount;
  const conversionPct = closedDeals > 0 ? Math.round((deals.wonCount / closedDeals) * 100) : null;

  const totalOutstanding = paymentSummary?.totalOutstanding ?? null;
  const bucketSentence = paymentSummary ? describeBuckets(paymentSummary.agingBuckets, paymentSummary.totalOutstanding) : null;
  const overdueOutstanding = paymentSummary
    ? paymentSummary.agingBuckets.filter((b) => b.bucket !== 'noDueDate' && b.bucket !== 'current').reduce((s, b) => s + b.amount, 0)
    : 0;

  return (
    <div className={styles.grid}>
      <Card interactive={!!onDealsClick} onClick={onDealsClick} className={styles.cell}>
        <div className={styles.label}>Deals Won</div>
        <div className={styles.value}>{deals.wonCount}</div>
        <div className={styles.caption}>of {totalDeals} deals in range</div>
        <div className={styles.divider} />
        <div className={styles.footer}>
          {overdueCount} overdue · {pendingCount} pending
        </div>
      </Card>

      <Card className={styles.cell}>
        <div className={styles.label}>Conversion</div>
        <div className={styles.value}>{conversionPct !== null ? `${conversionPct}%` : '—'}</div>
        <div className={styles.caption}>won / closed deals</div>
        <div className={styles.divider} />
        <div className={styles.footer}>{deals.lostCount} deals lost this month</div>
      </Card>

      <Card className={styles.cell}>
        <div className={styles.label}>Business Health</div>
        <div className={styles.value}>{businessHealthScore ?? '—'}</div>
        <div className={styles.caption}>composite score out of 100</div>
        {revenueTrend.length > 1 && (
          <div className={styles.sparkline}>
            <ResponsiveContainer width="100%" height={36}>
              <AreaChart data={revenueTrend} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <Area type="monotone" dataKey="achieved" stroke="var(--brand-accent-primary)" strokeWidth={2} fill="var(--color-accent-muted)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className={styles.cell}>
        <div className={styles.label}>Outstanding</div>
        <div className={styles.value}>{totalOutstanding !== null ? money(totalOutstanding) : '—'}</div>
        <div className={styles.caption}>{bucketSentence ?? 'Loading…'}</div>
        <div className={styles.divider} />
        <div className={overdueOutstanding > 0 ? styles.footerWarn : styles.footerOk}>
          {overdueOutstanding > 0 ? `${money(overdueOutstanding)} overdue` : 'No overdue payments'}
        </div>
      </Card>
    </div>
  );
}
