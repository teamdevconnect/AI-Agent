import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CustomerAcquisitionPoint } from '@/services/dealPerformanceService';
import styles from './CustomerAcquisitionTrendChart.module.css';

// Near-verbatim clone of business-dashboard/components/RevenueTrendChart.tsx
// — single series, same CSS-token styling, no new pattern.
export function CustomerAcquisitionTrendChart({ points }: { points: CustomerAcquisitionPoint[] }) {
  return (
    <div className={styles.wrapper}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={points}>
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
          <Line
            dataKey="newContacts"
            name="New Contacts"
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
