import { FiUsers } from 'react-icons/fi';
import { Button, SectionCard, StatTile } from '@/components/ui';
import type { CustomerActivityOverview } from '@/services/customerActivityService';
import styles from '../business-dashboard.module.css';

export interface TopItem {
  key: string;
  title: string;
  meta: string;
  valueLabel?: string;
}

// Compact cross-link into Deal Performance's/MyCustomerActivityPage's full
// Customer Activity experience — deliberately NOT the full table/digest/
// correlated-emails view (these dashboards are "at a glance" pages by
// design; the full experience is one click away via onViewFull).
export function CustomerActivitySection({
  data,
  topItemsTitle,
  topItems,
  viewFullLabel,
  onViewFull,
  extraStats = [],
}: {
  data: CustomerActivityOverview;
  topItemsTitle: string;
  topItems: TopItem[];
  viewFullLabel: string;
  onViewFull: () => void;
  // Phase 16 — additive, backward-compatible: lets each Home Dashboard view
  // surface a role-appropriate extra number (e.g. "Deals at Risk") alongside
  // this section's existing actioned-today stats, without this component
  // needing to know where that number comes from.
  extraStats?: { value: string | number; label: string }[];
}) {
  return (
    <SectionCard
      title="Customer Insights"
      icon={FiUsers}
      action={
        <Button type="button" variant="ghost" size="sm" onClick={onViewFull}>
          {viewFullLabel}
        </Button>
      }
    >
      <div className={styles.statsGrid}>
        <StatTile value={data.totalActionedToday} label="Actioned Today" />
        <StatTile value={data.actionedTodayCounts.existing} label="Existing" />
        <StatTile value={data.actionedTodayCounts.new} label="New" />
        <StatTile value={data.actionedTodayCounts.followUp} label="Follow-ups" />
        {extraStats.map((s) => (
          <StatTile key={s.label} value={s.value} label={s.label} />
        ))}
      </div>

      {topItems.length > 0 && (
        <>
          <span className={styles.sectionTitle}>{topItemsTitle}</span>
          {topItems.map((item) => (
            <div key={item.key} className={styles.listItem}>
              <div className={styles.listItemMain}>
                <span className={styles.listItemTitle}>{item.title}</span>
                <span className={styles.listItemMeta}>{item.meta}</span>
              </div>
              {item.valueLabel && <span className={styles.rankValue}>{item.valueLabel}</span>}
            </div>
          ))}
        </>
      )}
    </SectionCard>
  );
}
