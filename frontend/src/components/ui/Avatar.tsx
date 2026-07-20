import clsx from 'clsx';
import { initialsFromName } from '@/utils/format';
import styles from './Avatar.module.css';

export interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  status?: 'online' | 'offline' | 'busy';
  className?: string;
}

export function Avatar({ name, src, size = 'md', color, status, className }: AvatarProps) {
  return (
    <span
      className={clsx(styles.avatar, styles[size], className)}
      style={color ? { background: color } : undefined}
    >
      {src ? <img className={styles.image} src={src} alt="" /> : initialsFromName(name)}
      {status && <span className={clsx(styles.status, styles[status])} aria-hidden />}
    </span>
  );
}
