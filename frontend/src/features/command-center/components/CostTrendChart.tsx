import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CostTrendPoint } from '@/services/commandCenterService';
import styles from './CostTrendChart.module.css';

// Same conventions as frontend/src/features/business-dashboard/components/RevenueTrendChart.tsx —
// single series, CSS-token colors, no legend (section title identifies it).
export function CostTrendChart({ points }: { points: CostTrendPoint[] }) {
  return (
    <div className={styles.wrapper}>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" stroke="var(--color-text-muted)" fontSize={12} />
          <YAxis stroke="var(--color-text-muted)" fontSize={12} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
          <Tooltip
            formatter={(value: number) => `$${value.toFixed(4)}`}
            contentStyle={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
            }}
            labelStyle={{ color: 'var(--color-text-primary)' }}
          />
          <Line
            dataKey="cost"
            name="Cost"
            stroke="var(--brand-accent-primary)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--brand-accent-primary)' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
