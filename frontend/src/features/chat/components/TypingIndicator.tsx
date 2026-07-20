import { Avatar } from '@/components/ui';
import styles from './TypingIndicator.module.css';

export function TypingIndicator() {
  return (
    <div className={styles.wrapper}>
      <Avatar name="HaiVE AI" color="var(--brand-accent-secondary)" size="sm" />
      <div className={styles.dots}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
    </div>
  );
}
