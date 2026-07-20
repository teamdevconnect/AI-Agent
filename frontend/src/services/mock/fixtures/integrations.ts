export type IntegrationStatus = 'connected' | 'disconnected' | 'error';

export interface Integration {
  id: string;
  name: string;
  category: 'AI Model' | 'Communication';
  status: IntegrationStatus;
  description: string;
}

// Trimmed to the integrations this app actually wires up: Anthropic (real
// API key, stored server-side and used by python-agent for mail analysis),
// and Gmail / Outlook (email providers — Outlook has a real Microsoft Graph
// OAuth flow already built; Gmail has no OAuth client configured yet).
export const mockIntegrations: Integration[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    category: 'AI Model',
    status: 'disconnected',
    description: 'Claude models for chat, reasoning, and Outlook mail analysis.',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'Communication',
    status: 'disconnected',
    description: 'Send and read email via Gmail.',
  },
  {
    id: 'outlook',
    name: 'Microsoft Outlook',
    category: 'Communication',
    status: 'disconnected',
    description: 'Email and calendar via Microsoft Graph — analyzed using Claude.',
  },
];
