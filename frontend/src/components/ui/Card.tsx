import type { HTMLAttributes } from 'react';
import clsx from 'clsx';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  interactive?: boolean;
  glass?: boolean;
}

export function Card({ padded = true, interactive, glass, className, children, ...rest }: CardProps) {
  return (
    <div
      className={clsx(styles.card, padded && styles.padded, interactive && styles.interactive, glass && styles.glass, className)}
      {...rest}
    >
      {children}
    </div>
  );
}
