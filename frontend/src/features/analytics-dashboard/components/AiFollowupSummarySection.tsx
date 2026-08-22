import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { FiZap, FiClock, FiAlertTriangle, FiStar, FiMessageSquare } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { Card, SectionCard, Skeleton } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { aiFollowupSummaryService } from '@/services/aiFollowupSummaryService';
import { emailIntelligenceService } from '@/services/emailIntelligenceService';
import { PriorityQueueCard } from './PriorityQueueCard';
import biStyles from '@/features/business-intelligence/business-intelligence.module.css';
import styles from '../analytics-dashboard.module.css';
import heroStyles from './AiFollowupHero.module.css';
import statStyles from './AiFollowupStats.module.css';

function StatCard({ icon: Icon, label, value, note }: { icon: IconType; label: string; value: string | number; note: string }) {
  return (
    <Card className={statStyles.cell}>
      <span className={statStyles.iconBadge}>
        <Icon size={16} />
      </span>
      <div className={statStyles.label}>{label}</div>
      <div className={statStyles.value}>{value}</div>
      <div className={statStyles.note}>{note}</div>
    </Card>
  );
}

// Business Intelligence section 6 — AI Due-Date & Follow-Up Summary. The
// raw follow-up list is always rendered directly, regardless of AI
// generation state; the AI panel is a genuine, non-instant, button-triggered
// LLM call (direct adaptation of finance/components/FinanceSummaryPanel.tsx's
// own idle/loading/populated/error states) — never the passive always-on
// templated-insight pattern used elsewhere on this page. Always org/store-
// scoped to "today" — no date-range dimension (matches finance-summary.service.ts's
// own "cache key has no filter dimension" precedent), so this tab ignores
// the page's dateFrom/dateTo controls by design.
//
// "High priority" is deliberately gated on the AI summary having been
// generated (shows "—" until then) rather than derived from a heuristic,
// since "high priority customer" isn't a real stored field — only the AI's
// own reasoning ever produces that judgment. "Suggested replies" is real,
// always-available data: pending inbox items where the AI has already
// prepared a draftReply, independent of whether a summary was generated.
export function AiFollowupSummarySection() {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['dash-ai-followup-summary'],
    queryFn: () => aiFollowupSummaryService.getOverview(),
    staleTime: 30_000,
  });

  const { data: pendingEmails } = useQuery({
    queryKey: ['dash-followups-pending-emails'],
    queryFn: () => emailIntelligenceService.list('pending'),
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
  const reminders = data?.followUpReminders ?? [];

  const { dueTodayCount, overdueCount } = useMemo(() => {
    const today = dayjs();
    const pending = reminders.filter((f) => f.status === 'pending');
    return {
      dueTodayCount: pending.filter((f) => dayjs(f.dueDate).isSame(today, 'day')).length,
      overdueCount: pending.filter((f) => dayjs(f.dueDate).isBefore(today, 'day')).length,
    };
  }, [reminders]);

  const suggestedRepliesCount = useMemo(
    () => (pendingEmails ?? []).filter((e) => !!e.draftReply).length,
    [pendingEmails],
  );

  return (
    <div className={styles.tabContent}>
      <div className={heroStyles.card}>
        <div className={heroStyles.text}>
          <span className={heroStyles.label}>
            <FiZap size={13} /> AI Assistant
          </span>
          <div className={heroStyles.title}>Today's follow-up priorities</div>
          <p className={heroStyles.subtitle}>
            A real AI pass over today's follow-ups, overdue quotes/deals, and high-priority customers.
          </p>
        </div>
        <button type="button" className={heroStyles.generateBtn} disabled={generating} onClick={() => void handleGenerate(!!summary)}>
          <FiZap size={14} />
          {generating ? 'Generating…' : summary ? 'Regenerate summary' : 'Generate summary'}
        </button>
      </div>

      {isLoading || !data ? (
        <Skeleton height={100} />
      ) : (
        <div className={statStyles.grid}>
          <StatCard icon={FiClock} label="Due today" value={dueTodayCount} note="customer actions" />
          <StatCard icon={FiAlertTriangle} label="Overdue" value={overdueCount} note="need a response" />
          <StatCard
            icon={FiStar}
            label="High priority"
            value={summary ? summary.highPriorityCustomers.length : '—'}
            note={summary ? 'open opportunities' : 'generate a summary to see this'}
          />
          <StatCard icon={FiMessageSquare} label="Suggested replies" value={suggestedRepliesCount} note="ready to review" />
        </div>
      )}

      <PriorityQueueCard followUpReminders={reminders} />

      {summary && (
        <div className={biStyles.aiSummaryCard}>
          <span className={biStyles.aiInsightLabel}>
            <FiZap size={14} /> AI Summary — Today's Follow-Up Priorities
          </span>
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
        </div>
      )}

      <SectionCard title="Real Follow-Up Reminders" glass>
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
