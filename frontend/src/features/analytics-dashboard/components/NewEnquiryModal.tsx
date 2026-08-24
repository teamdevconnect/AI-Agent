import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Button, Input, Modal } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { dealsService, LEAD_SOURCES } from '@/services/dealsService';
import styles from './NewEnquiryModal.module.css';

export interface NewEnquiryModalProps {
  open: boolean;
  onClose: () => void;
  stores: { id: string; name: string }[];
  canOverrideStore: boolean;
}

// Creates a real Deal via the existing (previously frontend-unused) POST
// /crm/deals endpoint — same dealsService.create the Deal Assignment/CRM
// layer already relies on. Only Deal.name is actually required server-side;
// everything else here maps 1:1 onto real, optional CreateDealPayload
// fields — never a fabricated/derived value. Invalidates the dashboard's own
// overview query (prefix match) so the new deal is reflected immediately.
export function NewEnquiryModal({ open, onClose, stores, canOverrideStore }: NewEnquiryModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [storeId, setStoreId] = useState('');
  const [monetaryValue, setMonetaryValue] = useState('');
  const [expectedClosingDate, setExpectedClosingDate] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName('');
    setStoreId('');
    setMonetaryValue('');
    setExpectedClosingDate('');
    setLeadSource('');
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await dealsService.create({
        name: name.trim(),
        ...(storeId ? { storeId } : {}),
        ...(monetaryValue ? { monetaryValue: Number(monetaryValue) } : {}),
        ...(expectedClosingDate ? { expectedClosingDate } : {}),
        ...(leadSource ? { leadSource } : {}),
      });
      toast.success('Enquiry created');
      await queryClient.invalidateQueries({ queryKey: ['analytics-dashboard-overview'] });
      reset();
      onClose();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="New Enquiry" description="Log a new deal into the pipeline." maxWidth={480}>
      <div className={styles.form}>
        <Input label="Enquiry / deal name" placeholder="e.g. Acme Corp — Uniform order" value={name} onChange={(e) => setName(e.target.value)} />

        {canOverrideStore && stores.length > 0 && (
          <div className={styles.field}>
            <label className={styles.label}>Store</label>
            <select className={styles.select} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">Unassigned</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.row}>
          <Input
            label="Expected value (₹)"
            type="number"
            min={0}
            placeholder="0"
            value={monetaryValue}
            onChange={(e) => setMonetaryValue(e.target.value)}
          />
          <Input
            label="Expected closing date"
            type="date"
            value={expectedClosingDate}
            onChange={(e) => setExpectedClosingDate(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Lead source</label>
          <select className={styles.select} value={leadSource} onChange={(e) => setLeadSource(e.target.value)}>
            <option value="">Unspecified</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" loading={saving} disabled={!name.trim()} onClick={() => void handleCreate()}>
            Create enquiry
          </Button>
        </div>
      </div>
    </Modal>
  );
}
