import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dayjs } from '@/utils/date';
import type { TrendPoint } from '@/services/dashboardService';
import styles from './TaskTrendChart.module.css';

const tooltipStyle = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-text-primary)',
};

const formatDate = (d: string) => dayjs(d).format('MMM D');

// Change-over-time for one agent — a line chart, single series. No legend:
// the section title above it (rendered by the parent, e.g. "Task Volume —
// Last 7 Days") is the sole identifier per the dataviz method for a
// single-series chart. The priority mix (urgent/overdue) is a second,
// separate small stacked bar directly underneath rather than crammed into
// the same chart — two single-purpose charts instead of one overloaded /
// dual-axis chart, and status-coded (not identity-coded) so it reuses this
// app's existing --color-danger/--color-warning tokens, the same ones every
// priority Badge already uses.
export function TaskTrendChart({ points }: { points: TrendPoint[] }) {
  return (
    <div className={styles.wrapper}>
      <span className={styles.chartTitle}>Task Volume</span>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" tickFormatter={formatDate} stroke="var(--color-text-muted)" fontSize={12} />
          <YAxis stroke="var(--color-text-muted)" fontSize={12} allowDecimals={false} />
          <Tooltip
            labelFormatter={formatDate}
            contentStyle={tooltipStyle}
            labelStyle={{ color: 'var(--color-text-primary)' }}
          />
          <Line
            dataKey="totalTasks"
            name="Tasks"
            stroke="var(--brand-accent-primary)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'var(--brand-accent-primary)' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <span className={styles.mixTitle}>Priority Mix</span>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" tickFormatter={formatDate} stroke="var(--color-text-muted)" fontSize={12} />
          <YAxis stroke="var(--color-text-muted)" fontSize={12} allowDecimals={false} />
          <Tooltip
            labelFormatter={formatDate}
            contentStyle={tooltipStyle}
            labelStyle={{ color: 'var(--color-text-primary)' }}
          />
          <Bar dataKey="urgentCount" name="Urgent" stackId="mix" fill="var(--color-danger)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="overdueCount" name="Overdue" stackId="mix" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
