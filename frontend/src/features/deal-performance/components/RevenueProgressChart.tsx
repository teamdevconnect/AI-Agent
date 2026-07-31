import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RevenueProgressPoint } from '@/services/dealPerformanceService';
import styles from './RevenueProgressChart.module.css';

// Achieved-vs-target is a "delta to target" job, not two competing bars or a
// dual-axis chart — a single-hue bar (achieved) plus a dashed line (target)
// on one axis, per the same reasoning RevenueTrendChart.tsx already applies
// to a single measure over time.
export function RevenueProgressChart({ points }: { points: RevenueProgressPoint[] }) {
  return (
    <div className={styles.wrapper}>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="period" stroke="var(--color-text-muted)" fontSize={12} />
          <YAxis stroke="var(--color-text-muted)" fontSize={12} tickFormatter={(v: number) => v.toLocaleString()} />
          <Tooltip
            formatter={(value: number) => value.toLocaleString()}
            contentStyle={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
            }}
            labelStyle={{ color: 'var(--color-text-primary)' }}
          />
          <Bar dataKey="achieved" name="Achieved" fill="var(--brand-accent-primary)" radius={[4, 4, 0, 0]} />
          <Line
            dataKey="targetAmount"
            name="Target"
            stroke="var(--color-text-muted)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
