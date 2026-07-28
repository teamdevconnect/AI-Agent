import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardAgent } from '@/services/dashboardService';
import styles from './AgentComparisonChart.module.css';

// Same-day comparison across named entities (agents) — a bar chart, not a
// line (no time dimension). Color reuses each agent's own avatarColor
// (already assigned per-agent everywhere else in the UI — Avatar, agent
// cards) rather than a separate categorical chart palette, so a bar's color
// always matches that agent's color elsewhere. No legend — the x-axis
// category label under each bar is a direct label, a stronger identification
// mechanism than a legend box for a small, named set of categories.
export function AgentComparisonChart({
  agents,
  onSelect,
}: {
  agents: DashboardAgent[];
  onSelect: (agentId: string) => void;
}) {
  return (
    <div className={styles.wrapper}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={agents}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={12} />
          <YAxis stroke="var(--color-text-muted)" fontSize={12} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'var(--color-bg-hover)' }}
            contentStyle={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
            }}
            labelStyle={{ color: 'var(--color-text-primary)' }}
          />
          <Bar
            dataKey="todaysTaskCount"
            name="Tasks today"
            radius={[4, 4, 0, 0]}
            cursor="pointer"
            onClick={(data: DashboardAgent) => onSelect(data.id)}
          >
            {agents.map((a) => (
              <Cell key={a.id} fill={a.avatarColor} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
