// Friendly progress labels shown in the "thinking" bubble while a tool call
// is in flight. Keys must match python-agent's tool SPEC["name"] values
// exactly (app/tools/*.py) — grepped, not guessed.
export const TOOL_LABELS: Record<string, string> = {
  search_business_context: 'Searching CRM & Outlook…',
  search_documents: 'Checking your documents…',
  crm_contact: 'Looking up contact details…',
  crm_note: 'Checking CRM notes…',
  crm_deal: 'Checking deal details…',
  crm_account: 'Checking account details…',
  crm_quote: 'Checking quotes…',
  crm_tag: 'Checking tags…',
  crm_product: 'Checking products…',
  outlook_lookup: 'Searching Outlook…',
  calendar_tool: 'Checking the calendar…',
  employee_lookup: 'Looking up team members…',
  query_database: 'Querying the database…',
  send_email: 'Preparing an email…',
  send_whatsapp_message: 'Preparing a WhatsApp message…',
  web_search: 'Searching the web…',
};

export function toolLabel(tool: string | undefined): string {
  if (!tool) return 'Thinking…';
  return TOOL_LABELS[tool] ?? 'Thinking…';
}
