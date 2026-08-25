import { FiAlertCircle, FiCheckCircle, FiInfo, FiZap } from 'react-icons/fi';
import { SectionCard } from '@/components/ui';
import type { AiRecommendation } from '@/services/homeDashboardService';
import styles from '../business-dashboard.module.css';

const SEVERITY_ICON: Record<AiRecommendation['severity'], typeof FiInfo> = {
  critical: FiAlertCircle,
  warning: FiAlertCircle,
  info: FiCheckCircle,
};

// Tier 1 — replaces the old single-sentence "AI Insight"/"AI Recommendation"/
// "AI Coaching" card with a real stacked list of independent, deterministic
// bullets (see HomeDashboardService.buildRecommendations — never a live LLM
// call on page load/poll, matching this app's one unbroken "AI insight"
// convention).
export function AiRecommendationsSection({ items }: { items: AiRecommendation[] }) {
  return (
    <SectionCard title="AI Recommendations" icon={FiZap}>
      <div className={styles.stackList}>
        {items.map((item) => {
          const Icon = SEVERITY_ICON[item.severity];
          return (
            <div key={item.id} className={styles.recommendationRow} data-severity={item.severity}>
              <span>{item.text}</span>
              <Icon size={16} />
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
