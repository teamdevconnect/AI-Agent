import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { Card } from './Card';
import styles from './SectionCard.module.css';

export interface SectionCardProps {
  title: string;
  icon?: IconType;
  action?: ReactNode;
  children: ReactNode;
}

// Replaces the repeated "uppercase label + unwrapped content" convention
// duplicated across nearly every page's CSS module (dashboard, business-
// dashboard, deal-performance, finance, todo-eod) with an actual elevated
// card — clear visual boundaries between sections instead of everything
// running together in one continuous scroll. Content/children are passed
// through unchanged; this only changes the wrapper.
export function SectionCard({ title, icon: Icon, action, children }: SectionCardProps) {
  return (
    <Card className={styles.sectionCard}>
      <div className={styles.header}>
        <span className={styles.title}>
          {Icon && <Icon size={15} className={styles.icon} />}
          {title}
        </span>
        {action}
      </div>
      <div className={styles.body}>{children}</div>
    </Card>
  );
}
