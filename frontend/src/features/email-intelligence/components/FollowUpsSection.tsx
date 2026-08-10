import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Skeleton } from '@/components/ui';
import { emailIntelligenceService } from '@/services/emailIntelligenceService';
import { integrationsService } from '@/services/integrationsService';
import styles from '../email-intelligence.module.css';

// Follow-ups are created automatically as a side effect of Phase 14e's
// runPostSendActions() — a reminder to check back with a customer 3 days
// after a reply is actually SENT (not just approved). This means the empty
// state has three genuinely different real causes, and each needs different
// user action — never worth collapsing into one generic "no data" message.
export function FollowUpsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['email-intelligence-follow-ups'],
    queryFn: () => emailIntelligenceService.getFollowUps(),
    refetchInterval: 60_000,
  });
  const { data: outlookStatus } = useQuery({
    queryKey: ['outlook-status-for-followups'],
    queryFn: () => integrationsService.getOutlookStatus(),
    staleTime: 60_000,
  });

  if (isLoading || !data) return <Skeleton height={80} />;

  if (data.length === 0) {
    let message = 'No pending follow-ups. Follow-ups are created automatically 3 days after you send a reply to a customer.';
    if (outlookStatus && !outlookStatus.connected) {
      message = 'No pending follow-ups yet — connect Outlook in Integrations to start sending replies and generating follow-ups.';
    } else if (outlookStatus && outlookStatus.connected && !outlookStatus.canSend) {
      message =
        'No pending follow-ups yet. Your connected Outlook account can\'t send email yet — reconnect it in Integrations to grant permission to send, then follow-ups will start appearing after you send a reply.';
    }
    return <div className={styles.emptyState}>{message}</div>;
  }

  return (
    <div className={styles.formGrid}>
      {data.map((reminder) => (
        <div key={reminder._id} className={styles.listItem}>
          <div className={styles.listItemMain}>
            <span className={styles.listItemTitle}>{reminder.title}</span>
            <span className={styles.listItemMeta}>
              {reminder.businessName ? `${reminder.businessName} · ` : ''}
              Due {new Date(reminder.dueDate).toLocaleDateString()}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await emailIntelligenceService.markFollowUpDone(reminder._id);
              void queryClient.invalidateQueries({ queryKey: ['email-intelligence-follow-ups'] });
            }}
          >
            Mark Done
          </Button>
        </div>
      ))}
    </div>
  );
}
