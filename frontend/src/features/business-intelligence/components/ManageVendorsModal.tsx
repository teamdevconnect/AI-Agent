import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Badge, Button, Input, Modal, Skeleton } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { vendorsService } from '@/services/vendorsService';
import styles from '../business-intelligence.module.css';

// The only UI surface for the underlying Vendor CRUD (see vendors.controller.ts)
// — a simple add/list form, not a full procurement workflow (Vendor Quote is
// record-keeping, never a full RFQ/bidding system — see the plan's own note).
export function ManageVendorsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: vendors, isLoading } = useQuery({
    queryKey: ['bi-vendors'],
    queryFn: () => vendorsService.list(),
    enabled: open,
  });

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await vendorsService.create({ name: name.trim(), category: category.trim() || undefined });
      setName('');
      setCategory('');
      await queryClient.invalidateQueries({ queryKey: ['bi-vendors'] });
      toast.success('Vendor added');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Manage Vendors" maxWidth={560}>
      <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div className={styles.formRow}>
          <Input placeholder="Vendor name" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
          <Input placeholder="Category (optional)" value={category} onChange={(e) => setCategory(e.target.value)} style={{ flex: 1 }} />
          <Button size="sm" loading={saving} disabled={!name.trim()} onClick={() => void handleCreate()}>
            Add
          </Button>
        </div>

        {isLoading ? (
          <Skeleton height={120} />
        ) : !vendors || vendors.length === 0 ? (
          <div className={styles.emptyState}>No vendors yet — add one above.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {vendors.map((v) => (
              <div key={v._id} className={styles.listItem}>
                <div className={styles.listItemMain}>
                  <span className={styles.listItemTitle}>{v.name}</span>
                  {v.category && <span className={styles.listItemMeta}>{v.category}</span>}
                </div>
                <Badge variant={v.status === 'active' ? 'success' : 'neutral'}>{v.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
