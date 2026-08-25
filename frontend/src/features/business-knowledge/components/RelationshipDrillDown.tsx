import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FiArrowLeft,
  FiBarChart2,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiFileText,
  FiLink2,
  FiMail,
  FiTrendingUp,
} from 'react-icons/fi';
import { Badge, Button, SectionCard, Skeleton } from '@/components/ui';
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
  // Same collapse mechanics as DealFilterBar's "More filters" (Phase 15) —
  // overview/quotes/deals stay always visible; the three most detail-heavy,
  // least-at-a-glance-useful sections collapse behind this toggle.
  const [showDetails, setShowDetails] = useState(false);

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
          <SectionCard title="Relationship Overview" icon={FiBarChart2}>
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
          </SectionCard>

          {data.account && (
            <SectionCard title="Linked Account" icon={FiLink2}>
              <div className={styles.faqRow}>
                <span>{data.account.name}</span>
                <span className={styles.pageSubtitle}>
                  {[data.account.domain, data.account.city, data.account.industry].filter(Boolean).join(' · ') || 'No further details'}
                  {typeof data.account.revenue === 'number' ? ` · Revenue: ${data.account.revenue}` : ''}
                </span>
              </div>
            </SectionCard>
          )}

          <SectionCard title={`Quotes (${data.quotes.length})`} icon={FiFileText}>
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
          </SectionCard>

          <SectionCard title={`Deals (${data.deals.length})`} icon={FiTrendingUp}>
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
          </SectionCard>

          <div className={styles.detailsToggleRow}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              rightIcon={showDetails ? <FiChevronUp /> : <FiChevronDown />}
              onClick={() => setShowDetails((v) => !v)}
            >
              {showDetails ? 'Hide details' : 'Show more details'}
            </Button>
          </div>

          {showDetails && (
            <>
              <SectionCard title={`Today's Correlated Emails (${data.correlatedEmails.length})`} icon={FiMail}>
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
              </SectionCard>

              <SectionCard title={`Email History (${data.emailHistory.length})`} icon={FiMail}>
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
              </SectionCard>

              <SectionCard title={`Timeline (${data.timeline.length})`} icon={FiClock}>
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
              </SectionCard>
            </>
          )}
        </>
      )}
    </div>
  );
}
