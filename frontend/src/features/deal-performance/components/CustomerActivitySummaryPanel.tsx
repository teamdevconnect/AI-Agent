import { useState } from 'react';
import toast from 'react-hot-toast';
import { FiZap } from 'react-icons/fi';
import { Button } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import type { CustomerActivitySummaryResult } from '@/services/customerActivityService';
import styles from '../deal-performance.module.css';

// Deliberately NOT the passive always-on .aiInsightCard pattern used
// elsewhere on this page — that implies "already computed, just display
// it," which is false here. This is a real, non-instant, button-triggered
// LLM call (see customer-activity.service.ts's generateSummary), so it gets
// its own explicit generate/loading affordance and visually distinct
// styling instead.
export function CustomerActivitySummaryPanel({
  summary,
  onGenerate,
}: {
  summary: CustomerActivitySummaryResult | null;
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
          <FiZap size={14} /> AI Summary — Today's Customer Activity
        </span>
        <Button type="button" size="sm" variant={summary ? 'ghost' : 'primary'} loading={loading} onClick={() => void handleClick()}>
          {summary ? 'Regenerate' : 'Generate AI Summary'}
        </Button>
      </div>

      {!summary && !loading && (
        <span className={styles.fadeCaption}>
          Generates a real AI pass over today's CRM + email activity — prioritization and missed-important-email judgment calls, not the
          instant rule-based insight shown elsewhere.
        </span>
      )}

      {summary && (
        <>
          <span className={styles.aiInsightText}>{summary.aiSummary}</span>
          <span className={styles.fadeCaption}>Generated at {new Date(summary.generatedAt).toLocaleTimeString()}</span>

          {summary.prioritization.length > 0 && (
            <div className={styles.section}>
              <span className={styles.sectionTitle}>What Should Have Been Prioritized</span>
              {summary.prioritization.map((p, i) => (
                <div key={i} className={styles.listItem}>
                  <div className={styles.listItemMain}>
                    <span className={styles.listItemTitle}>{p.businessName}</span>
                    <span className={styles.listItemMeta}>{p.rationale}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {summary.missedImportantEmails.length > 0 && (
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Important Emails Missed Today</span>
              {summary.missedImportantEmails.map((m) => (
                <div key={m.emailId} className={styles.listItem}>
                  <div className={styles.listItemMain}>
                    <span className={styles.listItemTitle}>{m.subject}</span>
                    <span className={styles.listItemMeta}>{m.note}</span>
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
