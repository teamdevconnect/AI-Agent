import { useState } from 'react';
import toast from 'react-hot-toast';
import { FiZap } from 'react-icons/fi';
import { Button } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { formatINR as money } from '@/utils/currency';
import type { FinanceSummaryResult } from '@/services/financeDashboardService';
import styles from '../finance.module.css';

// Adapted clone of deal-performance/components/CustomerActivitySummaryPanel.tsx
// — not a shared generic component, since the two result shapes genuinely
// differ (prioritizedPayments/flaggedAnomalies vs. prioritization/
// missedImportantEmails). Deliberately NOT the passive always-on
// .aiInsightCard pattern used elsewhere on this page — this is a real,
// non-instant, button-triggered LLM call.
export function FinanceSummaryPanel({
  summary,
  onGenerate,
}: {
  summary: FinanceSummaryResult | null;
  onGenerate: (regenerate: boolean) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onGenerate(!!summary);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.aiSummaryCard}>
      <div className={styles.aiSummaryHeader}>
        <span className={styles.aiInsightLabel}>
          <FiZap size={14} /> AI Summary — Today's Vendor Payment Activity
        </span>
        <Button type="button" size="sm" variant={summary ? 'ghost' : 'primary'} loading={loading} onClick={() => void handleClick()}>
          {summary ? 'Regenerate' : 'Generate AI Summary'}
        </Button>
      </div>

      {!summary && !loading && (
        <span className={styles.fadeCaption}>
          Generates a real AI pass over today's vendor payment activity — prioritization and anomaly flags, not the instant rule-based
          insight shown elsewhere.
        </span>
      )}

      {summary && (
        <>
          <span className={styles.aiInsightText}>{summary.aiSummary}</span>
          <span className={styles.fadeCaption}>Generated at {new Date(summary.generatedAt).toLocaleTimeString()}</span>

          {summary.prioritizedPayments.length > 0 && (
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Payments to Prioritize</span>
              {summary.prioritizedPayments.map((p) => (
                <div key={p.documentId} className={styles.listItem}>
                  <div className={styles.listItemMain}>
                    <span className={styles.listItemTitle}>{p.vendorName}</span>
                    <span className={styles.listItemMeta}>{p.rationale}</span>
                  </div>
                  {p.amount !== undefined && <span className={styles.listItemMeta}>{money(p.amount)}</span>}
                </div>
              ))}
            </div>
          )}

          {summary.flaggedAnomalies.length > 0 && (
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Flagged Anomalies</span>
              {summary.flaggedAnomalies.map((a, i) => (
                <div key={a.documentId ?? i} className={styles.listItem}>
                  <div className={styles.listItemMain}>
                    <span className={styles.listItemTitle}>
                      {a.vendorName} — {a.anomalyType}
                    </span>
                    <span className={styles.listItemMeta}>{a.note}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
