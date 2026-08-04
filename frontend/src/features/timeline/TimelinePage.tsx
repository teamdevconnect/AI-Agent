import { useQuery } from '@tanstack/react-query';
import { Badge, Skeleton } from '@/components/ui';
import { timelineService, type TimelineEvent } from '@/services/timelineService';
import { dayjs, formatFullDate } from '@/utils/date';
import styles from './TimelinePage.module.css';

const MISSED_TYPES = new Set(['daily_report_missed']);

function badgeVariant(type: string): 'success' | 'warning' | 'info' {
  if (MISSED_TYPES.has(type)) return 'warning';
  if (type === 'achievement_unlocked') return 'info';
  return 'success';
}

function typeLabel(type: string): string {
  switch (type) {
    case 'daily_report_generated':
      return 'Report generated';
    case 'daily_report_missed':
      return 'Report missed';
    case 'task_completed':
      return 'Task completed';
    case 'achievement_unlocked':
      return 'Achievement';
    default:
      return type;
  }
}

function groupByDay(events: TimelineEvent[]): [string, TimelineEvent[]][] {
  const groups = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const key = dayjs(event.occurredAt).format('YYYY-MM-DD');
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups.entries()];
}

export function TimelinePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['timeline'],
    queryFn: () => timelineService.list(),
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className={styles.page}>
        <Skeleton height={100} />
        <Skeleton height={160} />
      </div>
    );
  }

  const groups = groupByDay(data);

  return (
    <div className={styles.page}>
      <div>
        <div className={styles.pageTitle}>Timeline</div>
        <div className={styles.pageSubtitle}>The business's memory — significant events as they happen</div>
      </div>

      {groups.length === 0 ? (
        <div className={styles.emptyState}>Nothing recorded yet.</div>
      ) : (
        groups.map(([day, events]) => (
          <div key={day} className={styles.group}>
            <span className={styles.groupLabel}>
              {dayjs(day).isToday() ? 'Today' : dayjs(day).format('MMMM D, YYYY')}
            </span>
            {events.map((event) => (
              <div key={event._id} className={styles.item}>
                <div className={styles.itemMain}>
                  <span className={styles.itemTitle}>{event.title}</span>
                  <span className={styles.itemMeta}>
                    {formatFullDate(event.occurredAt)}
                    {event.description ? ` — ${event.description}` : ''}
                  </span>
                </div>
                <Badge variant={badgeVariant(event.type)}>{typeLabel(event.type)}</Badge>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
