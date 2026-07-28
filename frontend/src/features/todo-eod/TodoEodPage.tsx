import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiChevronLeft, FiChevronRight, FiDownload, FiZap } from 'react-icons/fi';
import { Badge, Button, Card, Dropdown, IconButton, Tabs } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { dayjs, todayUtc } from '@/utils/date';
import { todoEodService } from '@/services/todoEodService';
import { Board } from './components/Board';
import { MonthCalendar } from './components/MonthCalendar';
import { PRIORITY_VARIANT } from './components/TaskCard';
import styles from './TodoEodPage.module.css';

// Recommendations only mean something for today's open tasks — a past
// board date's tasks are historical, not something to "focus on next".
function RecommendedFocus() {
  const { data, isLoading } = useQuery({
    queryKey: ['tasks-recommendations'],
    queryFn: () => todoEodService.getRecommendations(),
  });

  if (isLoading || !data || data.recommendations.length === 0) return null;

  return (
    <Card className={styles.recommendCard}>
      <div className={styles.recommendHeader}>
        <FiZap />
        <span className={styles.recommendTitle}>Recommended Focus</span>
      </div>
      <span className={styles.recommendNote}>{data.overallNote}</span>
      <div className={styles.recommendList}>
        {data.recommendations.map((r) => (
          <div key={r.taskId} className={styles.recommendRow}>
            <div className={styles.recommendRowHead}>
              <span className={styles.recommendRowTitle}>{r.task.title}</span>
              <Badge variant={PRIORITY_VARIANT[r.task.priority]}>{r.task.priority}</Badge>
              {r.task.isOverdue && <Badge variant="danger">Overdue</Badge>}
            </div>
            <span className={styles.recommendRationale}>{r.rationale}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

const VIEW_TABS = [
  { id: 'board', label: 'Board' },
  { id: 'calendar', label: 'Calendar' },
];

export function TodoEodPage() {
  const [view, setView] = useState<'board' | 'calendar'>('board');
  const [month, setMonth] = useState(todayUtc().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // The board is scoped to a single day (tasks are grouped per DailyReport,
  // which is per-day) — default to today, but let the user step back to
  // whichever day actually has a generated report, since "today" may not
  // have one yet (morning/EOD generation runs on a schedule). Uses UTC
  // "today" (todayUtc()), matching how the backend buckets reports — the
  // browser's local date can be a full day behind UTC for hours at a time,
  // which made the board default to a date with no data.
  const [boardDate, setBoardDate] = useState(todayUtc());

  const { data: calendarData } = useQuery({
    queryKey: ['tasks-calendar', month],
    queryFn: () => todoEodService.getCalendar(month),
    enabled: view === 'calendar',
  });

  const { data: dateTasks } = useQuery({
    queryKey: ['tasks', { dateFrom: selectedDate ?? undefined, dateTo: selectedDate ?? undefined }],
    queryFn: () => todoEodService.getTasks({ dateFrom: selectedDate ?? undefined, dateTo: selectedDate ?? undefined }),
    enabled: view === 'calendar' && !!selectedDate,
  });

  const handleDownload = async (format: 'pdf' | 'csv') => {
    try {
      const date = view === 'calendar' ? selectedDate : boardDate;
      const params = date ? { dateFrom: date, dateTo: date } : {};
      await todoEodService.downloadExport(format, params);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <span className={styles.pageTitle}>To-Do / EOD</span>
        <div className={styles.headerActions}>
          <Tabs items={VIEW_TABS} activeId={view} onChange={(id) => setView(id as 'board' | 'calendar')} />
          <Dropdown
            align="right"
            trigger={
              <Button type="button" variant="outline" leftIcon={<FiDownload />}>
                Download
              </Button>
            }
            items={[
              { id: 'pdf', label: 'Export as PDF', onSelect: () => void handleDownload('pdf') },
              { id: 'csv', label: 'Export as CSV', onSelect: () => void handleDownload('csv') },
            ]}
          />
        </div>
      </div>

      {view === 'board' ? (
        <>
          <div className={styles.boardDateNav}>
            <IconButton
              icon={<FiChevronLeft />}
              label="Previous day"
              onClick={() => setBoardDate(dayjs(boardDate).subtract(1, 'day').format('YYYY-MM-DD'))}
            />
            <span className={styles.boardDateLabel}>{dayjs(boardDate).format('dddd, MMM D, YYYY')}</span>
            <IconButton
              icon={<FiChevronRight />}
              label="Next day"
              onClick={() => setBoardDate(dayjs(boardDate).add(1, 'day').format('YYYY-MM-DD'))}
            />
            {boardDate !== todayUtc() && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setBoardDate(todayUtc())}>
                Today
              </Button>
            )}
          </div>
          {boardDate === todayUtc() && <RecommendedFocus />}
          <Board params={{ dateFrom: boardDate, dateTo: boardDate }} />
        </>
      ) : (
        <div className={styles.calendarLayout}>
          <div className={styles.calendarPanel}>
            <MonthCalendar
              month={month}
              days={calendarData?.days ?? []}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onMonthChange={setMonth}
            />
          </div>
          <div className={styles.selectedDateTasks}>
            {!selectedDate ? (
              <div className={styles.emptyState}>Select a date to see its tasks.</div>
            ) : !dateTasks || dateTasks.length === 0 ? (
              <div className={styles.emptyState}>No tasks for {selectedDate}.</div>
            ) : (
              dateTasks.map((task) => (
                <div key={task.id} className={styles.taskRow}>
                  <span>{task.title}</span>
                  <Badge variant={PRIORITY_VARIANT[task.priority]}>{task.priority}</Badge>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
