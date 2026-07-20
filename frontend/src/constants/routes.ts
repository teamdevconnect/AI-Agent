export const ROUTES = {
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',

  chat: '/chat',
  chatConversation: (id: string) => `/chat/${id}`,
  integrations: '/integrations',
  notifications: '/notifications',

  settings: '/settings',
  settingsGeneral: '/settings/general',
  settingsNotifications: '/settings/notifications',
  settingsSecurity: '/settings/security',

  profile: '/profile',
} as const;
