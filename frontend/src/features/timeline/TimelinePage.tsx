import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiClock } from 'react-icons/fi';
import { Badge, DateRangeControl, MultiSelectDropdown, SectionCard, Skeleton } from '@/components/ui';
import type { DateRange } from '@/components/ui';
import { timelineService, TIMELINE_EVENT_TYPE_OPTIONS, type TimelineEvent } from '@/services/timelineService';
import { dayjs, formatFullDate } from '@/utils/date';
import styles from './TimelinePage.module.css';

const MISSED_TYPES = new Set(['daily_report_missed']);

const TYPE_LABELS: Record<string, string> = Object.fromEntries(TIMELINE_EVENT_TYPE_OPTIONS.map((o) => [o.value, o.label]));

function badgeVariant(type: string): 'success' | 'warning' | 'info' {
  if (MISSED_TYPES.has(type)) return 'warning';
  if (type === 'achievement_unlocked') return 'info';
  return 'success';
}

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
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
  const [range, setRange] = useState<DateRange>({});
  const [types, setTypes] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['timeline', range],
    queryFn: () => timelineService.list({ from: range.dateFrom, to: range.dateTo }),
    refetchInterval: 60_000,
  });

  // Server-side date filtering (real, applied via the DTO's from/to); type
  // filtering stays client-side over that already-fetched set — the backend
  // DTO only accepts one `type` string, so forwarding a multi-select
  // selection would misrepresent what's actually being asked for.
  const filtered = data?.filter((e) => types.length === 0 || types.includes(e.type));

  return (
    <div className={styles.page}>
      <div>
        <div className={styles.pageTitle}>Timeline</div>
        <div className={styles.pageSubtitle}>The business's memory — significant events as they happen</div>
      </div>

      <div className={styles.filterRow}>
        <DateRangeControl value={range} onChange={setRange} />
        <MultiSelectDropdown label="Type" options={TIMELINE_EVENT_TYPE_OPTIONS} selected={types} onChange={setTypes} />
      </div>

      <SectionCard title="Timeline" icon={FiClock}>
        {isLoading || !filtered ? (
          <>
            <Skeleton height={100} />
            <Skeleton height={160} />
          </>
        ) : groupByDay(filtered).length === 0 ? (
          <div className={styles.emptyState}>Nothing recorded yet.</div>
        ) : (
          groupByDay(filtered).map(([day, events]) => (
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
      </SectionCard>
    </div>
  );
}
