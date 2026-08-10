import { useNavigate } from 'react-router-dom';
import { FiClock } from 'react-icons/fi';
import { Button, SectionCard } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { formatFullDate } from '@/utils/date';
import type { CompactTimelineEvent } from '@/services/homeDashboardService';
import styles from '../business-dashboard.module.css';

// Tier 7 — a compact live feed (small, fixed limit, no filter UI). Timeline's
// own full page with real date-range/type filters is untouched — this is
// the "compact view" the brief describes, that page is the "detailed view."
export function TimelineSection({ events }: { events: CompactTimelineEvent[] }) {
  const navigate = useNavigate();

  return (
    <SectionCard
      title="Timeline"
      icon={FiClock}
      action={
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate(ROUTES.timeline)}>
          View full Timeline →
        </Button>
      }
    >
      {events.length === 0 ? (
        <div className={styles.emptyState}>Nothing recorded yet.</div>
      ) : (
        events.map((e) => (
          <div key={e.id} className={styles.listItem}>
            <div className={styles.listItemMain}>
              <span className={styles.listItemTitle}>{e.title}</span>
              <span className={styles.listItemMeta}>{formatFullDate(e.occurredAt)}</span>
            </div>
          </div>
        ))
      )}
    </SectionCard>
  );
}
