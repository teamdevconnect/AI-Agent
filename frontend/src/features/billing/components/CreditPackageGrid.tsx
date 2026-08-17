import { Badge, Button, Card } from '@/components/ui';
import type { CreditPackage } from '@/services/billingService';
import { formatCurrency } from '@/utils/currency';
import styles from '../BillingPage.module.css';

export interface CreditPackageGridProps {
  packages: CreditPackage[];
  purchasingKey: string | null;
  onPurchase: (packageKey: string) => void;
}

export function CreditPackageGrid({ packages, purchasingKey, onPurchase }: CreditPackageGridProps) {
  return (
    <div className={styles.packageGrid}>
      {packages.map((pkg) => (
        <Card key={pkg.key} className={styles.packageCard}>
          <div>{pkg.name}</div>
          <div className={styles.packageCredits}>{(pkg.credits + pkg.bonusCredits).toLocaleString()}</div>
          <div className={styles.muted}>Haive Credits</div>
          {pkg.bonusCredits > 0 && (
            <Badge variant="success">+{pkg.bonusCredits.toLocaleString()} bonus</Badge>
          )}
          <div className={styles.packagePrice}>{formatCurrency(pkg.price, pkg.currency)}</div>
          <Button size="sm" loading={purchasingKey === pkg.key} onClick={() => onPurchase(pkg.key)}>
            Purchase
          </Button>
        </Card>
      ))}
    </div>
  );
}
