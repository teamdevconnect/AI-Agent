import type { ReactNode } from 'react';
import { Card } from '@/components/ui';
import styles from './SettingsSection.module.css';

export interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function SettingsSection({ title, description, children, footer }: SettingsSectionProps) {
  return (
    <Card className={styles.section}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        {description && <span className={styles.description}>{description}</span>}
      </div>
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </Card>
  );
}

export function SettingsField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}
