// The two real chat personas. Ids here must match python-agent's
// app/agent/personas.py PERSONAS dict keys exactly — that's the only thing
// keeping the two services in sync (intentionally lightweight: two static
// personas don't justify a shared package). Display metadata only — the
// actual system-prompt text lives in python-agent, since that's where the
// Anthropic call happens.
export interface ChatAgent {
  id: string;
  name: string;
  description: string;
  avatarColor: string;
}

export const CHAT_AGENTS: ChatAgent[] = [
  {
    id: 'store_manager',
    name: 'Store Manager',
    description: 'Daily operations, enquiries, follow-ups.',
    avatarColor: '#ed7e2c',
  },
  {
    id: 'sales_consultant',
    name: 'Sales Consultant',
    description: 'Pipeline, deals, quotes, revenue.',
    avatarColor: '#a85a1e',
  },
];
