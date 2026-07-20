import clsx from 'clsx';
import styles from './Spinner.module.css';

export interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 20, className }: SpinnerProps) {
  return (
    <span
      className={clsx(styles.spinner, className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}
