import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import clsx from 'clsx';
import { IconButton } from '@/components/ui';
import { dayjs, todayUtc } from '@/utils/date';
import type { CalendarDaySummary } from '@/services/todoEodService';
import styles from './MonthCalendar.module.css';

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export interface MonthCalendarProps {
  month: string; // "YYYY-MM"
  days: CalendarDaySummary[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onMonthChange: (month: string) => void;
}

export function MonthCalendar({ month, days, selectedDate, onSelectDate, onMonthChange }: MonthCalendarProps) {
  const summaryByDate = new Map(days.map((d) => [d.date, d]));
  const start = dayjs(`${month}-01`);
  const daysInMonth = start.daysInMonth();
  const leadingBlanks = start.day(); // 0 (Sun) - 6 (Sat)
  // UTC "today" — matches how the backend buckets reports (see todayUtc()'s
  // doc comment); the browser's local date can lag UTC by a full day.
  const today = todayUtc();

  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => start.date(i + 1).format('YYYY-MM-DD')),
  ];

  return (
    <div>
      <div className={styles.header}>
        <IconButton
          icon={<FiChevronLeft />}
          label="Previous month"
          onClick={() => onMonthChange(start.subtract(1, 'month').format('YYYY-MM'))}
        />
        <span className={styles.monthLabel}>{start.format('MMMM YYYY')}</span>
        <IconButton
          icon={<FiChevronRight />}
          label="Next month"
          onClick={() => onMonthChange(start.add(1, 'month').format('YYYY-MM'))}
        />
      </div>
      <div className={styles.grid}>
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className={styles.weekdayLabel}>
            {w}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`blank-${i}`} className={clsx(styles.dayCell, styles.dayCellEmpty)} />;
          const summary = summaryByDate.get(date);
          return (
            <button
              key={date}
              type="button"
              className={clsx(
                styles.dayCell,
                date === selectedDate && styles.dayCellSelected,
                date === today && styles.dayCellToday,
              )}
              onClick={() => onSelectDate(date)}
            >
              {dayjs(date).date()}
              {summary && summary.taskCount > 0 && (
                <span className={clsx(styles.dot, summary.hasUrgent && styles.dotUrgent)} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
