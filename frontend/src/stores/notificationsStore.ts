import { create } from 'zustand';
import { mockNotifications, type AppNotification } from '@/services/mock/fixtures/notifications';

interface NotificationsState {
  notifications: AppNotification[];
  unreadCount: () => number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: mockNotifications,

  unreadCount() {
    return get().notifications.filter((n) => !n.read).length;
  },

  markRead(id) {
    set((state) => ({ notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
  },

  markAllRead() {
    set((state) => ({ notifications: state.notifications.map((n) => ({ ...n, read: true })) }));
  },
}));
