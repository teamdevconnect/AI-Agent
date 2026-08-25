import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { Card } from './Card';
import { InfoPopover } from './InfoPopover';
import styles from './SectionCard.module.css';

export interface SectionCardProps {
  title: string;
  icon?: IconType;
  action?: ReactNode;
  children: ReactNode;
  // Opts into Card's glass surface (see Card.module.css's .glass) instead of
  // the flat default — additive, every existing call site keeps its current
  // flat look unless it explicitly passes this.
  glass?: boolean;
  // Additive — renders an InfoPopover info badge next to the title,
  // explaining what this card/table shows and how it's calculated. Omitted
  // keeps every existing call site's header unchanged.
  info?: ReactNode;
}

// Replaces the repeated "uppercase label + unwrapped content" convention
// duplicated across nearly every page's CSS module (dashboard, business-
// dashboard, deal-performance, finance, todo-eod) with an actual elevated
// card — clear visual boundaries between sections instead of everything
// running together in one continuous scroll. Content/children are passed
// through unchanged; this only changes the wrapper.
export function SectionCard({ title, icon: Icon, action, children, glass, info }: SectionCardProps) {
  return (
    <Card glass={glass} className={styles.sectionCard}>
      <div className={styles.header}>
        <span className={styles.title}>
          {Icon && <Icon size={15} className={styles.icon} />}
          {title}
          {info && <InfoPopover title={title}>{info}</InfoPopover>}
        </span>
        {action}
      </div>
      <div className={styles.body}>{children}</div>
    </Card>
  );
}
