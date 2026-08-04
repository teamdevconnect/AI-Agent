import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiLink2 } from 'react-icons/fi';
import { SectionCard, Skeleton } from '@/components/ui';
import { customerActivityService } from '@/services/customerActivityService';
import { CustomerActivityTable } from '@/features/deal-performance/components/CustomerActivityTable';
import { RelationshipDrillDown } from './RelationshipDrillDown';
import styles from '../business-knowledge.module.css';

// Reuses the existing org/store-scoped Customer Activity overview call and
// its CustomerActivityTable component verbatim (no fork) — this page is
// owner/admin/manager-only, so there's no personal/consultant scope to
// branch on here (see Phase 14a plan notes).
export function RelationshipsSection() {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customer-activity-overview'],
    queryFn: () => customerActivityService.getOverview(),
  });

  if (selectedKey) {
    return <RelationshipDrillDown businessKey={selectedKey} personal={false} onBack={() => setSelectedKey(null)} />;
  }

  return (
    <div className={styles.tabContent}>
      <SectionCard title="Customer Relationships" icon={FiLink2}>
        {isLoading || !data ? (
          <Skeleton height={220} />
        ) : (
          <CustomerActivityTable rows={data.businessTable} onSelectRow={(row) => setSelectedKey(row.key)} />
        )}
      </SectionCard>
    </div>
  );
}
