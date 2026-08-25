import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiCalendar, FiCheckSquare } from 'react-icons/fi';
import { Badge, Button, SectionCard } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { todoEodService } from '@/services/todoEodService';
import { PRIORITY_VARIANT } from '@/features/todo-eod/components/TaskCard';
import { dayjs, todayUtc } from '@/utils/date';
import styles from '../business-dashboard.module.css';

export interface CompactCalendarEvent {
  id: string;
  title: string;
  start: string;
  userName?: string;
}

function eventTime(start: string): string {
  return start ? dayjs(start).format('h:mm A') : '';
}

// Tier 3 — fires its own query against the existing GET /tasks endpoint
// (zero backend change), so this shows exactly what that user's own
// Todo/EOD board already shows for today, capped to the 5 most urgent/
// overdue first. Confirmed with the user: Today's Meetings stays alongside
// this tier as a small add-on rather than being dropped (no dedicated
// calendar page exists yet to send it to).
export function TodaysTasksSection({
  calendarEvents,
  calendarMessage,
}: {
  calendarEvents?: CompactCalendarEvent[];
  calendarMessage?: string;
}) {
  const navigate = useNavigate();
  const today = todayUtc();
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks-today'],
    queryFn: () => todoEodService.getTasks({ dateFrom: today, dateTo: today }),
    refetchInterval: 60_000,
  });

  const topTasks = [...(tasks ?? [])]
    .sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue) || (a.priority === 'urgent' ? -1 : 1))
    .slice(0, 5);

  return (
    <div className={styles.twoColumn}>
      <SectionCard
        title="Today's Tasks"
        icon={FiCheckSquare}
        action={
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate(ROUTES.todoEod)}>
            View full board →
          </Button>
        }
      >
        {isLoading || !tasks ? (
          <div className={styles.emptyState}>Loading…</div>
        ) : topTasks.length === 0 ? (
          <div className={styles.emptyState}>No tasks for today.</div>
        ) : (
          topTasks.map((t) => (
            <div key={t.id} className={styles.listItem}>
              <div className={styles.listItemMain}>
                <span className={styles.listItemTitle}>{t.title}</span>
                <span className={styles.listItemMeta}>{t.status.replace('_', ' ')}</span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {t.isOverdue && <Badge variant="danger">Overdue</Badge>}
                <Badge variant={PRIORITY_VARIANT[t.priority]}>{t.priority}</Badge>
              </div>
            </div>
          ))
        )}
      </SectionCard>

      <SectionCard title="Today's Meetings" icon={FiCalendar}>
        {calendarMessage ? (
          <div className={styles.emptyState}>{calendarMessage}</div>
        ) : !calendarEvents || calendarEvents.length === 0 ? (
          <div className={styles.emptyState}>No meetings today.</div>
        ) : (
          calendarEvents.map((e) => (
            <div key={e.id} className={styles.listItem}>
              <div className={styles.listItemMain}>
                <span className={styles.listItemTitle}>{e.title || 'Untitled event'}</span>
                <span className={styles.listItemMeta}>
                  {e.userName ? `${e.userName} — ` : ''}
                  {eventTime(e.start)}
                </span>
              </div>
            </div>
          ))
        )}
      </SectionCard>
    </div>
  );
}
