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
  chatHistory: '/history',
  help: '/help',
  // Kept as its own top-level route (not removed) — backend/src/outlook/
  // outlook.controller.ts's OAuth callback/adminConsentCallback redirect
  // here directly (`/integrations?outlook=<status>`), and IntegrationsPage's
  // own useEffect reads that query param. The real, discoverable entry
  // point is now Settings → Integrations (settingsIntegrations below); this
  // path still works for that redirect and any existing bookmarks.
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
  settingsRoyaltyRules: '/settings/royalty-rules',
  settingsIntegrations: '/settings/integrations',

  profile: '/profile',

  // Haive-internal only — never added to NAV_GROUPS. Reached by direct URL
  // by a user holding the manually-granted platform_admin role.
  platformAdminBilling: '/platform-admin/billing',
} as const;
