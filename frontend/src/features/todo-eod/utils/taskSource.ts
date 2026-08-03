import type { TodoTask } from '@/services/todoEodService';

export type TaskSource = 'crm' | 'mail' | 'other';

// TodoTask.category is freeform text from the AI report-extraction prompt (no
// controlled vocabulary — see REPORT_EXTRACTION_TOOL's system prompt), so
// there's no reliable "this task came from CRM" / "from an email" field to
// group on directly. This keyword heuristic over category + title is the best
// available signal today; it's intentionally simple and easy to extend if
// real category values turn out to need more keywords.
const MAIL_KEYWORDS = ['email', 'mail', 'outlook', 'inbox', 'correspondence'];
const CRM_KEYWORDS = [
  'crm',
  'deal',
  'lead',
  'quote',
  'customer',
  'client',
  'follow-up',
  'follow up',
  'pipeline',
  'contact',
  'account',
  'prospect',
  'sale',
];

export function classifyTaskSource(task: Pick<TodoTask, 'category' | 'title'>): TaskSource {
  const text = `${task.category ?? ''} ${task.title}`.toLowerCase();
  if (MAIL_KEYWORDS.some((kw) => text.includes(kw))) return 'mail';
  if (CRM_KEYWORDS.some((kw) => text.includes(kw))) return 'crm';
  return 'other';
}
