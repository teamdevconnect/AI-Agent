// Deterministic pre-filter, run before any LLM call. Catches the classic
// "never worth asking Claude" categories — bounce/delivery-failure notices,
// automated out-of-office replies, and marketing/newsletter mail — via
// cheap, conservative pattern matching. Only fires on unambiguous signals
// (bounce-sentinel addresses, auto-reply subject phrasing, a literal
// "unsubscribe" mention); never a guess dressed up as a rule. Cuts LLM
// cost/latency and removes an entire class of hallucination risk for mail
// that was never going to need a real reply in the first place.
//
// Deliberately does NOT attempt "invoice attached -> vendor" style detection
// — the fetched email shape (see outlook.py's _map_message) carries no
// attachment/header data to detect that from, and guessing would violate
// this codebase's "never invent a signal you don't actually have" rule.

export interface DeterministicPreFilterMatch {
  ruleName: 'bounce' | 'auto_reply' | 'marketing';
  reason: string;
}

const BOUNCE_SENDER_PATTERN = /^(postmaster|mailer-daemon|mail-daemon)@/i;
const BOUNCE_SUBJECT_PATTERN =
  /(undeliverable|delivery (status notification|has failed)|returned mail|mail delivery failed|delivery failure)/i;
const AUTO_REPLY_SUBJECT_PATTERN = /^(automatic reply|auto-?reply)\s*:|out of office/i;
const UNSUBSCRIBE_PATTERN = /unsubscribe/i;

export function classifyEmailDeterministically(email: {
  from: string;
  subject: string;
  preview: string;
}): DeterministicPreFilterMatch | null {
  const from = email.from.trim();
  const subject = email.subject.trim();
  const preview = email.preview.trim();

  if (BOUNCE_SENDER_PATTERN.test(from) || BOUNCE_SUBJECT_PATTERN.test(subject)) {
    return { ruleName: 'bounce', reason: 'Automated delivery failure / bounce notice — no action needed.' };
  }
  if (AUTO_REPLY_SUBJECT_PATTERN.test(subject)) {
    return { ruleName: 'auto_reply', reason: 'Automated out-of-office / auto-reply message — no action needed.' };
  }
  if (UNSUBSCRIBE_PATTERN.test(subject) || UNSUBSCRIBE_PATTERN.test(preview)) {
    return { ruleName: 'marketing', reason: 'Marketing/newsletter email (unsubscribe footer detected) — no action needed.' };
  }
  return null;
}
