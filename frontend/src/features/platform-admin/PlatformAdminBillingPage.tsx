import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiDollarSign, FiPercent, FiServer, FiTrendingUp } from 'react-icons/fi';
import { Badge, SectionCard, StatTile } from '@/components/ui';
import {
  billingAdminService,
  type AdminOverview,
  type AdminPaymentRecord,
  type OrganizationBilling,
} from '@/services/billingAdminService';
import { extractErrorMessage } from '@/utils/errors';
import { formatFullDate } from '@/utils/date';
import { formatCurrency } from '@/utils/currency';
import styles from './PlatformAdminBillingPage.module.css';

// Haive-internal only — reachable only via direct URL for a user holding
// the platform_admin role (see routes/index.tsx's RequireRole wrapper and
// backend/src/billing/billing-admin.controller.ts's @Roles gate). This is
// the one place provider cost, revenue, and gross margin are ever shown —
// never linked from anywhere a customer-org user would see it.
export function PlatformAdminBillingPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationBilling[]>([]);
  const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([billingAdminService.getOverview(30), billingAdminService.getOrganizations(30), billingAdminService.listPayments({ limit: 25 })])
      .then(([o, orgs, p]) => {
        setOverview(o);
        setOrganizations(orgs);
        setPayments(p);
      })
      .catch((error) => toast.error(extractErrorMessage(error)))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !overview) {
    return <div className={styles.page}>Loading...</div>;
  }

  return (
    <div className={styles.page}>
      <div>
        <div className={styles.title}>Haive Billing — Internal</div>
        <div className={styles.subtitle}>Revenue, provider cost, and gross margin across every organization. Last {overview.days} days.</div>
      </div>

      <div className={styles.statGrid}>
        <StatTile icon={FiDollarSign} value={`$${overview.revenueUsd.toFixed(2)}`} label="Revenue" />
        <StatTile icon={FiServer} value={`$${overview.providerCostUsd.toFixed(2)}`} label="Provider Cost" />
        <StatTile icon={FiTrendingUp} value={`$${overview.grossProfitUsd.toFixed(2)}`} label="Gross Profit" />
        <StatTile icon={FiPercent} value={`${overview.realizedMarginPct}%`} label="Realized Margin" />
        <StatTile value={overview.creditsSold.toLocaleString()} label="Credits Sold" />
        <StatTile value={overview.creditsUsed.toLocaleString()} label="Credits Used" />
        <StatTile value={overview.totalAiRequests.toLocaleString()} label="AI Requests" />
      </div>

      <SectionCard title="By Organization">
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Revenue</th>
                <th>Provider Cost</th>
                <th>Gross Profit</th>
                <th>Requests</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => (
                <tr key={org.organizationId}>
                  <td>{org.name}</td>
                  <td>${org.revenueUsd.toFixed(2)}</td>
                  <td>${org.providerCostUsd.toFixed(2)}</td>
                  <td>${org.grossProfitUsd.toFixed(2)}</td>
                  <td>{org.totalRequests.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Recent Payments">
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Organization</th>
                <th>Type</th>
                <th>Provider</th>
                <th>Amount</th>
                <th>Credits</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id}>
                  <td>{formatFullDate(p.createdAt)}</td>
                  <td>{p.organizationId}</td>
                  <td>{p.type}</td>
                  <td>{p.provider}</td>
                  <td>
                    {formatCurrency(p.amount, p.currency)}
                    {p.simulated && (
                      <span style={{ marginLeft: 6 }}>
                        <Badge variant="warning">simulated</Badge>
                      </span>
                    )}
                  </td>
                  <td>{p.creditsGranted.toLocaleString()}</td>
                  <td>
                    <Badge variant={p.status === 'captured' ? 'success' : p.status === 'failed' ? 'danger' : 'neutral'}>{p.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
