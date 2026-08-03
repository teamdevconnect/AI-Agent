import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthlyExpensePoint } from '@/services/financeDashboardService';
import styles from './MonthlyExpenseTrendChart.module.css';

// Near-verbatim clone of business-dashboard/components/RevenueTrendChart.tsx
// / deal-performance's CustomerAcquisitionTrendChart.tsx — single series,
// same CSS-token styling, no new pattern.
export function MonthlyExpenseTrendChart({ points }: { points: MonthlyExpensePoint[] }) {
  return (
    <div className={styles.wrapper}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={points}>
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
          <Line
            dataKey="amount"
            name="Expenses"
            stroke="var(--brand-accent-primary)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'var(--brand-accent-primary)' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
