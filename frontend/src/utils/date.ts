import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
<<<<<<< HEAD
=======
import utc from 'dayjs/plugin/utc';
>>>>>>> 6a60a8648 (Initial AI Agent source code)

dayjs.extend(relativeTime);
dayjs.extend(isToday);
dayjs.extend(isYesterday);
<<<<<<< HEAD
=======
dayjs.extend(utc);

// The backend buckets daily reports/tasks by UTC date (todayStamp() in
// dashboard.service.ts/tasks.service.ts — new Date().toISOString().slice(0,10)).
// Computing "today" from the browser's local timezone instead would disagree
// with the backend for several hours a day (anyone west of UTC), making the
// To-Do/EOD board silently show a date with no data. Always use this for
// "today" where it needs to match what the backend considers today.
export function todayUtc(): string {
  return dayjs.utc().format('YYYY-MM-DD');
}
>>>>>>> 6a60a8648 (Initial AI Agent source code)

export function formatMessageTime(iso: string): string {
  return dayjs(iso).format('h:mm A');
}

export function formatRelativeTime(iso: string): string {
  return dayjs(iso).fromNow();
}

export function formatFullDate(iso: string): string {
  return dayjs(iso).format('MMM D, YYYY [at] h:mm A');
}

export type ConversationGroupKey = 'today' | 'yesterday' | 'lastWeek' | 'older';

export function getConversationGroup(iso: string): ConversationGroupKey {
  const date = dayjs(iso);
  if (date.isToday()) return 'today';
  if (date.isYesterday()) return 'yesterday';
  if (date.isAfter(dayjs().subtract(7, 'day'))) return 'lastWeek';
  return 'older';
}

export const CONVERSATION_GROUP_LABELS: Record<ConversationGroupKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  lastWeek: 'Last 7 Days',
  older: 'Older',
};

export { dayjs };
