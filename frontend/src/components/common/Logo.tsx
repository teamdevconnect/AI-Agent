import clsx from 'clsx';
import styles from './Logo.module.css';

export interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <span className={clsx(styles.logo, className)}>
      <svg viewBox="0 0 150 32" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="HaiVE AI">
        <polygon points="16,1 28.5,8.5 28.5,23.5 16,31 3.5,23.5 3.5,8.5" fill="var(--brand-accent-primary)" />
        <polygon
          points="16,7.5 22.5,11.3 22.5,20.7 16,24.5 9.5,20.7 9.5,11.3"
          fill="none"
          stroke="var(--brand-bg-primary)"
          strokeWidth="1.4"
          opacity="0.4"
        />
        <text x="38" y="22.5" fontFamily="Inter, sans-serif" fontSize="19" fontWeight={700} letterSpacing="0.3" fill="currentColor">
          HaiVE
        </text>
      </svg>
    </span>
  );
}
