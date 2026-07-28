import clsx from 'clsx';
import { Card } from '@/components/ui';
import styles from './StatTile.module.css';

export function StatTile({
  value,
  label,
  active,
  onClick,
}: {
  value: string | number;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      interactive={!!onClick}
      className={clsx(styles.tile, active && styles.tileActive)}
      onClick={onClick}
    >
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
    </Card>
  );
}
