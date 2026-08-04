import clsx from 'clsx';
import type { IconType } from 'react-icons';
import { FiArrowDown, FiArrowUp } from 'react-icons/fi';
import { Card } from '@/components/ui';
import styles from './StatTile.module.css';

export interface StatTileTrend {
  direction: 'up' | 'down';
  label: string;
}

export function StatTile({
  value,
  label,
  active,
  onClick,
  icon: Icon,
  trend,
}: {
  value: string | number;
  label: string;
  active?: boolean;
  onClick?: () => void;
  // Both optional and additive — most existing call sites pass neither, so
  // this is zero behavior/visual change for them.
  icon?: IconType;
  trend?: StatTileTrend;
}) {
  return (
    <Card
      interactive={!!onClick}
      className={clsx(styles.tile, active && styles.tileActive)}
      onClick={onClick}
    >
      {Icon && (
        <span className={styles.iconBadge}>
          <Icon size={14} />
        </span>
      )}
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
      {trend && (
        <span className={clsx(styles.trend, trend.direction === 'up' ? styles.trendUp : styles.trendDown)}>
          {trend.direction === 'up' ? <FiArrowUp size={11} /> : <FiArrowDown size={11} />}
          {trend.label}
        </span>
      )}
    </Card>
  );
}
