import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCreditCard, FiDatabase, FiPieChart, FiZap } from 'react-icons/fi';
import { SectionCard, StatTile, Tabs } from '@/components/ui';
import { billingService } from '@/services/billingService';
import type {
  CreditPackage,
  CustomerTransaction,
  PaymentMethod,
  UsageSummary,
  WalletSummary,
} from '@/services/billingService';
import { useAuthStore } from '@/stores/authStore';
import { extractErrorMessage } from '@/utils/errors';
import { hasRole } from '@/utils/roles';
import { AutoPaySettingsCard } from './components/AutoPaySettingsCard';
import { RazorpayCheckoutModal } from './components/RazorpayCheckoutModal';
import { TransactionHistoryTable } from './components/TransactionHistoryTable';
import { WalletBalanceCard } from './components/WalletBalanceCard';
import styles from './BillingPage.module.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'history', label: 'History' },
  { id: 'autopay', label: 'Auto Recharge' },
];

// The customer-facing Command Center for Haive Credits — separate from the
// admin-only /command-center page (which shows raw provider/cost internals
// this page must never surface). Balance/usage/history are visible to
// every real role; Auto Recharge configuration and purchasing are further
// restricted to owner/admin below, mirroring Finance's role split.
export function BillingPage() {
  const user = useAuthStore((state) => state.user);
  const canManageBilling = hasRole(user, 'owner') || hasRole(user, 'admin');

  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);

  const loadAll = () => {
    Promise.all([
      billingService.getWallet(),
      billingService.getUsageSummary(),
      billingService.listPackages(),
      billingService.listTransactions(50),
      canManageBilling ? billingService.listPaymentMethods() : Promise.resolve([]),
    ])
      .then(([w, u, p, t, m]) => {
        setWallet(w);
        setUsage(u);
        setPackages(p);
        setTransactions(t);
        setPaymentMethods(m);
      })
      .catch((error) => toast.error(extractErrorMessage(error)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !wallet || !usage) {
    return <div className={styles.page}>Loading...</div>;
  }

  return (
    <div className={styles.page}>
      <WalletBalanceCard
        wallet={wallet}
        onAddCredits={() => setPurchaseModalOpen(true)}
        onEnableAutoPay={() => setActiveTab('autopay')}
      />

      <div className={styles.tabBar}>
        <Tabs items={canManageBilling ? TABS : TABS.filter((t) => t.id !== 'autopay')} activeId={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'overview' && (
        <>
          <div className={styles.statGrid}>
            <StatTile icon={FiDatabase} value={usage.creditsUsedTotal.toLocaleString()} label="Credits Used" />
            <StatTile icon={FiPieChart} value={usage.aiRequestCount.toLocaleString()} label="AI Requests" />
            <StatTile value={usage.totalInputTokens.toLocaleString()} label="Input Tokens" />
            <StatTile value={usage.totalOutputTokens.toLocaleString()} label="Output Tokens" />
            <StatTile value={usage.totalTokens.toLocaleString()} label="Total Tokens" />
            <StatTile value={usage.totalPurchasedCredits.toLocaleString()} label="Total Purchased" />
            <StatTile value={usage.usageTodayCredits.toLocaleString()} label="Usage Today" />
            <StatTile value={usage.usageThisMonthCredits.toLocaleString()} label="Usage This Month" />
            <StatTile
              icon={FiZap}
              value={wallet.autoPay.enabled ? 'ON' : 'OFF'}
              label="Auto Recharge"
            />
          </div>
        </>
      )}

      {activeTab === 'history' && (
        <SectionCard title="Transaction History" icon={FiCreditCard}>
          <TransactionHistoryTable transactions={transactions} />
        </SectionCard>
      )}

      {activeTab === 'autopay' && canManageBilling && (
        <SectionCard title="Auto Recharge Settings" icon={FiZap}>
          <AutoPaySettingsCard
            autoPay={wallet.autoPay}
            paymentMethods={paymentMethods}
            onChanged={loadAll}
            onRequirePurchase={() => setPurchaseModalOpen(true)}
          />
        </SectionCard>
      )}

      <RazorpayCheckoutModal
        open={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        packages={packages}
        onPurchased={loadAll}
      />
    </div>
  );
}
