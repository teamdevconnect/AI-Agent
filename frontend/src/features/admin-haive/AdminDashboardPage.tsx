import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiActivity,
  FiAlertCircle,
  FiArchive,
  FiCheckCircle,
  FiCreditCard,
  FiDollarSign,
  FiRefreshCw,
  FiRepeat,
  FiUsers,
} from 'react-icons/fi';
import { SectionCard, Skeleton, StatTile } from '@/components/ui';
import { billingAdminService, type AdminAnalytics, type AdminDashboard } from '@/services/billingAdminService';
import { extractErrorMessage } from '@/utils/errors';
import { AdminRangeControl } from './AdminRangeControl';
import { AdminLineChart } from './components/AdminLineChart';

export function AdminDashboardPage() {
  const [days, setDays] = useState(30);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([billingAdminService.getDashboard(days), billingAdminService.getAnalytics(days)])
      .then(([d, a]) => {
        setDashboard(d);
        setAnalytics(a);
      })
      .catch((error) => toast.error(extractErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 700 }}>Dashboard</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Platform-wide activity across every organization.
          </p>
        </div>
        <AdminRangeControl days={days} onChange={setDays} />
      </div>

      {loading || !dashboard ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} height={92} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
          <StatTile icon={FiUsers} value={dashboard.totalOrganizations.toLocaleString()} label="Total Organizations" />
          <StatTile icon={FiCheckCircle} value={dashboard.activeOrganizations.toLocaleString()} label="Active Organizations" />
          <StatTile icon={FiUsers} value={dashboard.totalUsers.toLocaleString()} label="Total Users" />
          <StatTile icon={FiRepeat} value={dashboard.activeSubscriptions.toLocaleString()} label="Active Subscriptions" />
          <StatTile icon={FiDollarSign} value={`$${dashboard.revenueUsd.toFixed(2)}`} label="Total Revenue" />
          <StatTile icon={FiCheckCircle} value={dashboard.successfulPaymentsCount.toLocaleString()} label="Successful Payments" />
          <StatTile icon={FiAlertCircle} value={dashboard.failedPaymentsCount.toLocaleString()} label="Failed Payments" />
          <StatTile icon={FiRefreshCw} value={dashboard.refundedPaymentsCount.toLocaleString()} label="Refunded Payments" />
          <StatTile icon={FiCreditCard} value={dashboard.creditsSold.toLocaleString()} label="Credits Sold" />
          <StatTile icon={FiActivity} value={dashboard.creditsUsed.toLocaleString()} label="Credits Consumed" />
          <StatTile icon={FiArchive} value={dashboard.creditsOutstanding.toLocaleString()} label="Credits Outstanding" />
          <StatTile
            icon={FiRefreshCw}
            value={dashboard.autoRechargeEventsInPeriod.toLocaleString()}
            label="Auto-Recharge Events"
            trend={{ direction: 'up', label: `${dashboard.autoRechargeEnabledWallets} wallets enabled` }}
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-5)' }}>
        <SectionCard title="Revenue Over Time">
          {loading || !analytics ? <Skeleton height={220} /> : <AdminLineChart data={analytics.revenueSeries} color="#5b8def" valueFormatter={(v) => `$${v.toFixed(0)}`} />}
        </SectionCard>
        <SectionCard title="Credit Usage Over Time">
          {loading || !analytics ? <Skeleton height={220} /> : <AdminLineChart data={analytics.creditUsageSeries} color="#4ade80" />}
        </SectionCard>
        <SectionCard title="New Organizations Over Time">
          {loading || !analytics ? <Skeleton height={220} /> : <AdminLineChart data={analytics.newOrganizationsSeries} color="#fbbf24" />}
        </SectionCard>
        <SectionCard title="Subscription Growth">
          {loading || !analytics ? <Skeleton height={220} /> : <AdminLineChart data={analytics.subscriptionGrowthSeries} color="#a78bfa" />}
        </SectionCard>
      </div>
    </div>
  );
}
