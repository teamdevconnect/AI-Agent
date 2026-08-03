import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Input, Modal } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import {
  CUSTOMER_TYPES,
  LEAD_SOURCES,
  REGIONS,
  dealsService,
  type CreateDealPayload,
  type Deal,
} from '@/services/dealsService';
import { isOpaqueStageId } from '@/utils/stageLabel';
import styles from './DealFormModal.module.css';

export interface DealFormModalProps {
  open: boolean;
  onClose: () => void;
  deal?: Deal;
  employees: { id: string; name: string }[];
  stores: { id: string; name: string }[];
  productSuggestions: string[];
  onSaved: (deal: Deal) => void;
}

const EMPTY: CreateDealPayload = { name: '', dealStatus: 'open', monetaryValue: 0 };

const COMMON_LOST_REASONS = [
  'Price',
  'Timing / not ready to purchase',
  'Chose a competitor',
  'No response',
  'Budget constraints',
  'Product mismatch',
];

// First real use of the previously-unused Modal.tsx component in this app —
// deliberately scoped to this small transient CRUD form only; drill-down
// elsewhere in this feature stays the state-swap pattern (DealListView.tsx),
// keeping the two interaction patterns distinct.
export function DealFormModal({ open, onClose, deal, employees, stores, productSuggestions, onSaved }: DealFormModalProps) {
  const [form, setForm] = useState<CreateDealPayload>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      deal
        ? {
            name: deal.name,
            storeId: deal.storeId,
            ownerId: deal.ownerId,
            stageId: deal.stageId,
            dealStatus: deal.dealStatus,
            monetaryValue: deal.monetaryValue,
            expectedClosingDate: deal.expectedClosingDate,
            leadSource: deal.leadSource,
            product: deal.product,
            customerType: deal.customerType,
            region: deal.region,
            lostReason: deal.lostReason,
          }
        : EMPTY,
    );
  }, [open, deal]);

  // Only force a reason on a fresh transition INTO 'lost' — an
  // already-lost deal being edited for an unrelated reason (e.g.
  // reassigning its owner) shouldn't suddenly be blocked from saving.
  const enteringLost = deal?.dealStatus !== 'lost' && form.dealStatus === 'lost';

  const set = <K extends keyof CreateDealPayload>(key: K, value: CreateDealPayload[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Deal name is required');
      return;
    }
    if (enteringLost && !form.lostReason?.trim()) {
      toast.error('A reason is required when marking a deal as lost');
      return;
    }
    setSaving(true);
    try {
      const saved = deal ? await dealsService.update(deal._id, form) : await dealsService.create(form);
      toast.success(deal ? 'Deal updated' : 'Deal created');
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={deal ? 'Edit Deal' : 'New Deal'} maxWidth={480}>
      <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
        <Input label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} required />

        <div className={styles.row}>
          <Input
            label="Value (₹)"
            type="number"
            min={0}
            value={form.monetaryValue ?? 0}
            onChange={(e) => set('monetaryValue', Number(e.target.value))}
          />
          <Input
            label="Expected/Closing Date"
            type="date"
            value={form.expectedClosingDate ?? ''}
            onChange={(e) => set('expectedClosingDate', e.target.value || undefined)}
          />
        </div>

        <div className={styles.row}>
          <label className={styles.label}>
            Status
            <select className={styles.select} value={form.dealStatus ?? 'open'} onChange={(e) => set('dealStatus', e.target.value as CreateDealPayload['dealStatus'])}>
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </label>
          <label className={styles.label}>
            Store
            <select className={styles.select} value={form.storeId ?? ''} onChange={(e) => set('storeId', e.target.value || undefined)}>
              <option value="">— None —</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {form.dealStatus === 'lost' && (
          <label className={styles.label}>
            Lost Reason{enteringLost ? ' (required)' : ''}
            <Input
              list="deal-lost-reason-suggestions"
              value={form.lostReason ?? ''}
              onChange={(e) => set('lostReason', e.target.value || undefined)}
              placeholder="Why was this deal lost?"
            />
            <datalist id="deal-lost-reason-suggestions">
              {COMMON_LOST_REASONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </label>
        )}

        <div className={styles.row}>
          <label className={styles.label}>
            Owner
            <select className={styles.select} value={form.ownerId ?? ''} onChange={(e) => set('ownerId', e.target.value || undefined)}>
              <option value="">Unassigned</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            Stage
            <Input
              value={form.stageId ?? ''}
              onChange={(e) => set('stageId', e.target.value || undefined)}
              hint={form.stageId && isOpaqueStageId(form.stageId) ? "Synced from an external CRM — editing won't rename the stage there." : undefined}
            />
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>
            Lead Source
            <select className={styles.select} value={form.leadSource ?? ''} onChange={(e) => set('leadSource', e.target.value || undefined)}>
              <option value="">— Not set —</option>
              {LEAD_SOURCES.map((v) => (
                <option key={v} value={v}>
                  {v.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            Customer Type
            <select className={styles.select} value={form.customerType ?? ''} onChange={(e) => set('customerType', e.target.value || undefined)}>
              <option value="">— Not set —</option>
              {CUSTOMER_TYPES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>
            Product
            <Input
              list="deal-product-suggestions"
              value={form.product ?? ''}
              onChange={(e) => set('product', e.target.value || undefined)}
            />
            <datalist id="deal-product-suggestions">
              {productSuggestions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
          <label className={styles.label}>
            Region
            <select className={styles.select} value={form.region ?? ''} onChange={(e) => set('region', e.target.value || undefined)}>
              <option value="">— Not set —</option>
              {REGIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.footer}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {deal ? 'Save Changes' : 'Create Deal'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
