import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { WonLostTrendPoint } from '@/services/dealPerformanceService';
import styles from './WonLostTrendChart.module.css';

// Won/Lost is semantically good/bad, not a generic identity — wears this
// app's existing status tokens (success/danger) rather than a new
// categorical palette, matching Badge's own status-color convention. No
// legend — same convention as TaskTrendChart.tsx's priority-mix chart; the
// Tooltip's own series names plus the parent's section title are enough to
// disambiguate two bars. Bars are clickable when `onSelect` is passed,
// drilling into that month + status's deal list.
export function WonLostTrendChart({
  points,
  onSelect,
}: {
  points: WonLostTrendPoint[];
  onSelect?: (period: string, status: 'won' | 'lost') => void;
}) {
  return (
    <div className={styles.wrapper}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="period" stroke="var(--color-text-muted)" fontSize={12} />
          <YAxis stroke="var(--color-text-muted)" fontSize={12} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
            }}
            labelStyle={{ color: 'var(--color-text-primary)' }}
          />
          <Bar
            dataKey="wonCount"
            name="Won"
            fill="var(--color-success)"
            radius={[4, 4, 0, 0]}
            cursor={onSelect ? 'pointer' : undefined}
            onClick={onSelect ? (point: WonLostTrendPoint) => onSelect(point.period, 'won') : undefined}
          />
          <Bar
            dataKey="lostCount"
            name="Lost"
            fill="var(--color-danger)"
            radius={[4, 4, 0, 0]}
            cursor={onSelect ? 'pointer' : undefined}
            onClick={onSelect ? (point: WonLostTrendPoint) => onSelect(point.period, 'lost') : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
