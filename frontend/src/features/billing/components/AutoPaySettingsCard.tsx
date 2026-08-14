import { useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { Button, Input, Switch } from '@/components/ui';
import { billingService } from '@/services/billingService';
import type { AutoPaySettings, PaymentMethod } from '@/services/billingService';
import { extractErrorMessage } from '@/utils/errors';
import styles from '../BillingPage.module.css';

export interface AutoPaySettingsCardProps {
  autoPay: AutoPaySettings;
  paymentMethods: PaymentMethod[];
  onChanged: () => void;
  // Opens the credit-purchase checkout (owned by BillingPage, alongside
  // this card) — a card can only ever be saved from a real, completed
  // checkout (Razorpay signs it), so "add a payment method" here means
  // "go buy credits and choose to save the card", not a standalone action.
  onRequirePurchase: () => void;
}

// "Auto Recharge" — matches OpenAI's API billing terminology this was
// modeled after: when enabled, Haive can automatically purchase more
// credits using the saved payment method on file once the balance reaches
// the configured threshold, topping it back up to a target balance (not a
// fixed package — the charge amount is computed fresh each time from
// however many credits are actually needed, see AutoPayService.attemptRecharge).
// No provider is ever mentioned here.
export function AutoPaySettingsCard({ autoPay, paymentMethods, onChanged, onRequirePurchase }: AutoPaySettingsCardProps) {
  const [enabled, setEnabled] = useState(autoPay.enabled);
  const [threshold, setThreshold] = useState(String(autoPay.thresholdCredits));
  const [target, setTarget] = useState(String(autoPay.targetBalanceCredits));
  const [monthlyCap, setMonthlyCap] = useState(autoPay.monthlyCapCredits ? String(autoPay.monthlyCapCredits) : '');
  const [paymentMethodId] = useState(autoPay.paymentMethodId ?? paymentMethods[0]?._id ?? '');
  const [saving, setSaving] = useState(false);

  const handleDeletePaymentMethod = async (id: string) => {
    try {
      await billingService.deletePaymentMethod(id);
      toast.success('Payment method removed');
      onChanged();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
  };

  const handleSave = async () => {
    const thresholdCredits = Number.parseInt(threshold, 10) || 0;
    const targetBalanceCredits = Number.parseInt(target, 10) || 0;

    if (enabled) {
      if (!paymentMethodId) {
        toast.error('Make a Haive Credits purchase and choose to save your card at checkout, then enable Auto Recharge.');
        onRequirePurchase();
        return;
      }
      if (targetBalanceCredits <= thresholdCredits) {
        toast.error('The target balance must be higher than the low-balance threshold.');
        return;
      }
    }

    const monthlyCapCredits = monthlyCap.trim() ? Number.parseInt(monthlyCap, 10) || 0 : undefined;

    setSaving(true);
    try {
      await billingService.updateAutoPay({
        enabled,
        thresholdCredits,
        targetBalanceCredits,
        paymentMethodId: paymentMethodId || undefined,
        monthlyCapCredits,
      });
      toast.success(`Auto Recharge ${enabled ? 'enabled' : 'disabled'}`);
      onChanged();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.autopayGrid}>
      <Switch
        checked={enabled}
        onChange={setEnabled}
        label="Auto Recharge"
        description="When enabled, Haive can automatically purchase more Haive Credits using your default payment method on file when your balance reaches your configured threshold."
      />

      <div>
        <span className={styles.fieldLabel}>Payment methods</span>
        {paymentMethods.length === 0 ? (
          <p className={styles.muted}>
            No payment method on file yet. Make a Haive Credits purchase and choose to save your card at checkout —
            it will then be available for Auto Recharge.
          </p>
        ) : (
          <div className={styles.paymentMethodList}>
            {paymentMethods.map((method) => (
              <div key={method._id} className={styles.paymentMethodRow}>
                <span className={styles.muted}>
                  {method.cardNetwork.toUpperCase()} •••• {method.cardLast4}
                  {method.isDefault ? ' (default)' : ''}
                </span>
                <Button size="sm" variant="ghost" leftIcon={<FiTrash2 />} onClick={() => handleDeletePaymentMethod(method._id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
        <Button size="sm" variant="outline" leftIcon={<FiPlus />} onClick={onRequirePurchase} style={{ marginTop: 'var(--space-2)' }}>
          {paymentMethods.length === 0 ? 'Buy credits to add a payment method' : 'Add another payment method'}
        </Button>
      </div>

      <div className={styles.autopayThresholdRow}>
        <Input
          label="When credit balance reaches"
          hint="Auto Recharge triggers at or below this"
          type="number"
          min={0}
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
        />
        <Input
          label="Bring balance back up to"
          hint="Must be higher than the threshold"
          type="number"
          min={1}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
      </div>

      <Input
        label="Monthly recharge limit (optional)"
        hint="Auto Recharge stops for the rest of the calendar month once this many credits have been added"
        type="number"
        min={0}
        placeholder="No limit"
        value={monthlyCap}
        onChange={(e) => setMonthlyCap(e.target.value)}
      />

      <Button loading={saving} onClick={handleSave}>
        Save Auto Recharge Settings
      </Button>
    </div>
  );
}
