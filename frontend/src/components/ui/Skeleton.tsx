import clsx from 'clsx';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circle' | 'rect';
  className?: string;
}

export function Skeleton({ width = '100%', height, variant = 'rect', className }: SkeletonProps) {
  return (
    <span
      className={clsx(styles.skeleton, variant === 'text' && styles.text, variant === 'circle' && styles.circle, className)}
      style={{ width, height: height ?? (variant === 'text' ? undefined : 100) }}
      aria-hidden
    />
  );
}
