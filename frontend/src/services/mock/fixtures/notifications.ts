export type NotificationKind = 'system' | 'integration' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
}

export const mockNotifications: AppNotification[] = [
  { id: 'n1', kind: 'integration', title: 'Slack connected', description: 'Your Slack workspace was linked successfully.', timestamp: '2026-07-16T05:40:00.000Z', read: false },
  { id: 'n2', kind: 'warning', title: 'Elevated response time', description: 'gpt-5.4 responses are averaging 30% slower than usual.', timestamp: '2026-07-16T01:05:00.000Z', read: false },
  { id: 'n3', kind: 'system', title: 'Weekly usage report ready', description: 'Your workspace usage summary for last week is available.', timestamp: '2026-07-15T09:00:00.000Z', read: true },
  { id: 'n4', kind: 'error', title: 'Qdrant connection failed', description: 'Vector search is degraded until the connection is restored.', timestamp: '2026-07-14T18:22:00.000Z', read: true },
];
