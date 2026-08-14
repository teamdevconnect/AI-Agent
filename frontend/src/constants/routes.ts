export const ROUTES = {
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  oauthCallback: '/oauth/callback',

  dashboard: '/dashboard',
  agentActivity: '/agent-activity',
  timeline: '/timeline',
  commandCenter: '/command-center',
  dealPerformance: '/deal-performance',
  myCustomerActivity: '/my-customer-activity',
  businessKnowledge: '/business-knowledge',
  emailIntelligence: '/ai-email-inbox',
  finance: '/finance',
  reporting: '/reporting',
  todoEod: '/todo-eod',
  chat: '/chat',
  chatConversation: (id: string) => `/chat/${id}`,
  integrations: '/integrations',
  billing: '/billing',
  notifications: '/notifications',

  settings: '/settings',
  settingsGeneral: '/settings/general',
  settingsNotifications: '/settings/notifications',
  settingsSecurity: '/settings/security',
  settingsAgentRoles: '/settings/agent-roles',
  settingsUsers: '/settings/users',
  settingsSalesTargets: '/settings/sales-targets',
  settingsDealAssignment: '/settings/deal-assignment',
  settingsWorkflows: '/settings/workflows',
  settingsRoyaltyRules: '/settings/royalty-rules',

  profile: '/profile',

  // Haive-internal only — never added to PRIMARY_NAV_ITEMS. Reached by
  // direct URL by a user holding the manually-granted platform_admin role.
  platformAdminBilling: '/platform-admin/billing',
} as const;
