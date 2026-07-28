export const ROUTES = {
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',

<<<<<<< HEAD
=======
  dashboard: '/dashboard',
  todoEod: '/todo-eod',
>>>>>>> 6a60a8648 (Initial AI Agent source code)
  chat: '/chat',
  chatConversation: (id: string) => `/chat/${id}`,
  integrations: '/integrations',
  notifications: '/notifications',

  settings: '/settings',
  settingsGeneral: '/settings/general',
  settingsNotifications: '/settings/notifications',
  settingsSecurity: '/settings/security',
<<<<<<< HEAD
=======
  settingsAgentRoles: '/settings/agent-roles',
  settingsUsers: '/settings/users',
>>>>>>> 6a60a8648 (Initial AI Agent source code)

  profile: '/profile',
} as const;
