import { FiBookOpen, FiInbox, FiMessageCircle, FiUsers } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { hasRole } from '@/utils/roles';
import { ROUTES } from '@/constants/routes';
import styles from './HelpSupportPage.module.css';

const TOPICS = [
  {
    icon: FiMessageCircle,
    title: 'Ask HaiVE AI',
    description: 'Start a new chat and ask a question in plain language — it can look up deals, quotes, customers, and documents for you.',
    action: 'Open chat',
    path: ROUTES.chat,
  },
  {
    icon: FiInbox,
    title: 'Chat History',
    description: 'Every past conversation is saved and searchable — reopen, rename, pin, or archive any of them.',
    action: 'View history',
    path: ROUTES.chatHistory,
  },
  {
    icon: FiBookOpen,
    title: 'Business Knowledge',
    description: 'Browse the documents and policies your organization has uploaded for the AI to reference.',
    action: 'Open Business Knowledge',
    path: ROUTES.businessKnowledge,
  },
];

export function HelpSupportPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const canManageOrg = hasRole(user, 'owner') || hasRole(user, 'admin');

  return (
    <div className={styles.page}>
      <div className={styles.title}>Help & Support</div>
      <p className={styles.subtitle}>Find your way around HaiVE AI, or get in touch with the people who manage your workspace.</p>

      <div className={styles.grid}>
        {TOPICS.map((topic) => (
          <Card key={topic.title} interactive className={styles.card} onClick={() => navigate(topic.path)}>
            <topic.icon className={styles.cardIcon} />
            <div className={styles.cardTitle}>{topic.title}</div>
            <p className={styles.cardDescription}>{topic.description}</p>
          </Card>
        ))}
      </div>

      <Card className={styles.contactCard}>
        <FiUsers className={styles.cardIcon} />
        <div>
          <div className={styles.cardTitle}>Need something else?</div>
          <p className={styles.cardDescription}>
            {canManageOrg
              ? 'As an owner or admin, you can manage users, roles, and integrations from Settings.'
              : 'Your workspace owner or admin can add teammates, adjust permissions, and manage billing.'}
          </p>
        </div>
      </Card>
    </div>
  );
}
