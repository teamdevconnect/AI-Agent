import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiZap } from 'react-icons/fi';
import { Button, SectionCard, Skeleton } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { aiFollowupSummaryService } from '@/services/aiFollowupSummaryService';
import biStyles from '@/features/business-intelligence/business-intelligence.module.css';
import styles from '../analytics-dashboard.module.css';

// Business Intelligence section 6 — AI Due-Date & Follow-Up Summary. The
// raw follow-up list is always rendered directly, regardless of AI
// generation state; the AI panel is a genuine, non-instant, button-triggered
// LLM call (direct adaptation of finance/components/FinanceSummaryPanel.tsx's
// own idle/loading/populated/error states) — never the passive always-on
// templated-insight pattern used elsewhere on this page. Always org/store-
// scoped to "today" — no date-range dimension (matches finance-summary.service.ts's
// own "cache key has no filter dimension" precedent), so this tab ignores
// the page's dateFrom/dateTo controls by design.
export function AiFollowupSummarySection() {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['dash-ai-followup-summary'],
    queryFn: () => aiFollowupSummaryService.getOverview(),
    staleTime: 30_000,
  });

  const handleGenerate = async (regenerate: boolean) => {
    setGenerating(true);
    try {
      await aiFollowupSummaryService.generate(regenerate);
      await queryClient.invalidateQueries({ queryKey: ['dash-ai-followup-summary'] });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const summary = data?.aiGeneratedSummary ?? null;

  return (
    <div className={styles.tabContent}>
      <div className={biStyles.aiSummaryCard}>
        <div className={biStyles.aiSummaryHeader}>
          <span className={biStyles.aiInsightLabel}>
            <FiZap size={14} /> AI Summary — Today's Follow-Up Priorities
          </span>
          <Button
            type="button"
            size="sm"
            variant={summary ? 'ghost' : 'primary'}
            loading={generating}
            onClick={() => void handleGenerate(!!summary)}
          >
            {summary ? 'Regenerate' : 'Generate AI Summary'}
          </Button>
        </div>

        {!summary && !generating && (
          <span className={biStyles.fadeCaption}>
            Generates a real AI pass over today's follow-ups, overdue quotes/deals, and high-priority customers.
          </span>
        )}

        {summary && (
          <>
            <span className={biStyles.aiInsightText}>{summary.aiSummary}</span>
            <span className={biStyles.fadeCaption}>Generated at {new Date(summary.generatedAt).toLocaleTimeString()}</span>

            {summary.todaysPriorities.length > 0 && (
              <div className={biStyles.section}>
                <span className={biStyles.sectionTitle}>Today's Priorities</span>
                {summary.todaysPriorities.map((p, i) => (
                  <div key={i} className={biStyles.listItem}>
                    <div className={biStyles.listItemMain}>
                      <span className={biStyles.listItemTitle}>{p.title}</span>
                      <span className={biStyles.listItemMeta}>{p.rationale}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {summary.highPriorityCustomers.length > 0 && (
              <div className={biStyles.section}>
                <span className={biStyles.sectionTitle}>High-Priority Customers</span>
                {summary.highPriorityCustomers.map((c, i) => (
                  <div key={i} className={biStyles.listItem}>
                    <div className={biStyles.listItemMain}>
                      <span className={biStyles.listItemTitle}>{c.businessName}</span>
                      <span className={biStyles.listItemMeta}>{c.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {summary.recommendedActions.length > 0 && (
              <div className={biStyles.section}>
                <span className={biStyles.sectionTitle}>Recommended Actions</span>
                {summary.recommendedActions.map((a, i) => (
                  <div key={i} className={biStyles.listItem}>
                    <div className={biStyles.listItemMain}>
                      <span className={biStyles.listItemTitle}>{a}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <SectionCard title="Real Follow-Up Reminders">
        {isLoading || !data ? (
          <Skeleton height={160} />
        ) : data.followUpReminders.length === 0 ? (
          <div className={styles.emptyState}>No pending follow-up reminders — nothing outstanding right now.</div>
        ) : (
          data.followUpReminders.map((f) => (
            <div key={f._id} className={styles.listItem} style={{ marginBottom: 8 }}>
              <div className={styles.listItemMain}>
                <span className={styles.listItemTitle}>{f.title}</span>
                <span className={styles.listItemMeta}>
                  {f.businessName ?? 'Unknown business'} · Due {new Date(f.dueDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </SectionCard>
    </div>
  );
}
