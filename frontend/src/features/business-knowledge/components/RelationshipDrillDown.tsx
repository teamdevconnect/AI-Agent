import { useQuery } from '@tanstack/react-query';
import { FiArrowLeft } from 'react-icons/fi';
import { Badge, Button, Skeleton } from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';
import { formatStageLabel } from '@/utils/stageLabel';
import { customerActivityService } from '@/services/customerActivityService';
import styles from '../business-knowledge.module.css';

const CONFIDENCE_VARIANT: Record<string, BadgeVariant> = {
  exact: 'success',
  domain: 'warning',
  fuzzy: 'neutral',
};

const RISK_VARIANT: Record<string, BadgeVariant> = {
  Healthy: 'success',
  'Needs Attention': 'warning',
  'At Risk': 'danger',
};

const SENTIMENT_VARIANT: Record<string, BadgeVariant> = {
  negative: 'danger',
  frustrated: 'danger',
  positive: 'success',
  neutral: 'neutral',
};

function sourceHint(source: 'account' | 'quote_client_details' | 'deal_name_heuristic'): string | undefined {
  if (source === 'account') return undefined;
  if (source === 'quote_client_details') return 'From quote client details';
  return 'Derived from deal name';
}

// Nested-card relationship view — deliberately NOT a node-edge graph (see
// Phase 14a plan notes: no graph database exists, and the full intended
// entity chain — Order/Negotiation/Invoice/Support Ticket — doesn't exist
// anywhere in this codebase yet). Reuses Phase 11/12's business-grouping/
// email-correlation logic via the backend's Customer Timeline endpoint
// (Phase 14c — a strict superset of Phase 14a's relationship view, adding
// real historical email context, a deterministic risk score, and lifetime
// value on top of the same account/quotes/deals data).
export function RelationshipDrillDown({
  businessKey,
  personal,
  onBack,
}: {
  businessKey: string;
  personal: boolean;
  onBack: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['business-customer-timeline', businessKey, personal],
    queryFn: () =>
      personal ? customerActivityService.getPersonalCustomerTimeline(businessKey) : customerActivityService.getCustomerTimeline(businessKey),
  });

  return (
    <div className={styles.tabContent}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.pageTitle}>{data?.businessName ?? 'Loading…'}</div>
          {data && sourceHint(data.businessNameSource) && <div className={styles.pageSubtitle}>{sourceHint(data.businessNameSource)}</div>}
        </div>
        <Button type="button" variant="ghost" size="sm" leftIcon={<FiArrowLeft />} onClick={onBack}>
          Back
        </Button>
      </div>

      {isLoading || !data ? (
        <Skeleton height={280} />
      ) : (
        <>
          <div className={styles.statsGrid}>
            <div className={styles.card}>
              <div className={styles.fieldLabel}>Lifetime Value</div>
              <span>{data.lifetimeValue}</span>
            </div>
            <div className={styles.card}>
              <div className={styles.fieldLabel}>Relationship Health</div>
              <Badge variant={RISK_VARIANT[data.riskLabel]}>
                {data.riskLabel} ({data.riskScore})
              </Badge>
            </div>
          </div>

          {data.account && (
            <div className={styles.faqRow}>
              <span className={styles.fieldLabel}>Linked Account</span>
              <span>{data.account.name}</span>
              <span className={styles.pageSubtitle}>
                {[data.account.domain, data.account.city, data.account.industry].filter(Boolean).join(' · ') || 'No further details'}
                {typeof data.account.revenue === 'number' ? ` · Revenue: ${data.account.revenue}` : ''}
              </span>
            </div>
          )}

          <div className={styles.faqRow}>
            <span className={styles.fieldLabel}>Quotes ({data.quotes.length})</span>
            {data.quotes.length === 0 ? (
              <span className={styles.pageSubtitle}>No quotes for this business.</span>
            ) : (
              data.quotes.map((q) => {
                const linkedDeal = q.dealId ? data.deals.find((d) => d.id === q.dealId) : undefined;
                return (
                  <div key={q.id} className={styles.faqRow}>
                    <span>
                      {q.quoteNumber ? `Quote #${q.quoteNumber}` : q.quoteName ?? 'Untitled quote'} — {q.quoteAmount} {q.currency}
                    </span>
                    <span className={styles.pageSubtitle}>Status: {q.quoteStatus}</span>
                    {linkedDeal && (
                      <span className={styles.pageSubtitle}>
                        Linked deal: {linkedDeal.name} ({linkedDeal.dealStatus}
                        {linkedDeal.stageId ? `, ${formatStageLabel(linkedDeal.stageId)}` : ''})
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className={styles.faqRow}>
            <span className={styles.fieldLabel}>Deals ({data.deals.length})</span>
            {data.deals.length === 0 ? (
              <span className={styles.pageSubtitle}>No deals for this business.</span>
            ) : (
              data.deals.map((d) => (
                <div key={d.id} className={styles.faqRow}>
                  <span>{d.name}</span>
                  <span className={styles.pageSubtitle}>
                    {d.dealStatus} · {d.monetaryValue}
                    {d.stageId ? ` · ${formatStageLabel(d.stageId)}` : ''}
                    {d.expectedClosingDate ? ` · Closing ${d.expectedClosingDate}` : ''}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className={styles.faqRow}>
            <span className={styles.fieldLabel}>Today's Correlated Emails ({data.correlatedEmails.length})</span>
            {data.correlatedEmails.length === 0 ? (
              <span className={styles.pageSubtitle}>No emails correlated to this business today.</span>
            ) : (
              data.correlatedEmails.map((e) => (
                <div key={e.id} className={styles.faqRow}>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <span>{e.subject}</span>
                    <Badge variant={CONFIDENCE_VARIANT[e.matchConfidence]}>{e.matchConfidence}</Badge>
                  </div>
                  <span className={styles.pageSubtitle}>
                    From {e.from} · {new Date(e.receivedAt).toLocaleString()}
                  </span>
                  <span className={styles.pageSubtitle}>{e.preview}</span>
                </div>
              ))
            )}
          </div>

          <div className={styles.faqRow}>
            <span className={styles.fieldLabel}>Email History ({data.emailHistory.length})</span>
            {data.emailHistory.length === 0 ? (
              <span className={styles.pageSubtitle}>No AI-analyzed emails on record for this business yet.</span>
            ) : (
              data.emailHistory.map((e) => (
                <div key={e._id} className={styles.faqRow}>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <span>{e.subject || '(no subject)'}</span>
                    <Badge variant="accent">{e.intent.replace(/_/g, ' ')}</Badge>
                    <Badge variant={SENTIMENT_VARIANT[e.sentiment] ?? 'neutral'}>{e.sentiment}</Badge>
                  </div>
                  <span className={styles.pageSubtitle}>
                    From {e.fromAddress} · {new Date(e.receivedAt).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className={styles.faqRow}>
            <span className={styles.fieldLabel}>Timeline ({data.timeline.length})</span>
            {data.timeline.length === 0 ? (
              <span className={styles.pageSubtitle}>No history yet.</span>
            ) : (
              data.timeline.map((t, i) => (
                <div key={i} className={styles.faqRow}>
                  <span>{t.title}</span>
                  <span className={styles.pageSubtitle}>
                    {new Date(t.date).toLocaleString()} · {t.description}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
