import clsx from 'clsx';
import styles from './Logo.module.css';

export interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <span className={clsx(styles.logo, className)}>
      <img src="/haive-logo.png" alt="" className={styles.mark} />
      <span className={styles.wordmark}>HaiVE</span>
    </span>
  );
}
