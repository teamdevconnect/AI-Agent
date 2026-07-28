// Friendly labels for the specialist keys the backend's 'plan' event names
// (python-agent's app/agent/specialists.py) — same style as toolLabels.ts's
// TOOL_LABELS, kept as a separate map since these are specialist agents, not
// individual tool calls.
export const AGENT_LABELS: Record<string, string> = {
  crm: 'Searching CRM',
  outlook: 'Reading Outlook',
  calendar: 'Checking the calendar',
  knowledge: 'Searching the knowledge base',
  operations: 'Checking store records',
};

export function agentLabel(agent: string): string {
  return AGENT_LABELS[agent] ?? `Checking ${agent}`;
}

export function planStatus(agents: string[]): string {
  if (agents.length === 0) return 'Planning…';
  return `${agents.map(agentLabel).join(', ')}…`;
}
