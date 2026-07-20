import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';

dayjs.extend(relativeTime);
dayjs.extend(isToday);
dayjs.extend(isYesterday);

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
