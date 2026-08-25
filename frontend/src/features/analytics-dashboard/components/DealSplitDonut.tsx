import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import styles from './DealSplitDonut.module.css';

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

// The first real pie/donut chart in this app (a deliberate, confirmed
// one-time exception — every other "split by category" widget elsewhere
// uses a ranked list instead, see RankedBreakdownList/PipelineByStageChart's
// own comments for why). Generic: reused for deals won/lost/pipeline,
// quotes accepted/not-accepted, customers new/existing/lost. Always ships a
// legend plus direct value labels (never relies on arc angles alone for
// exact counts) and a total caption — a 3-series pie is exactly the case
// both conventions exist for.
export function DealSplitDonut({
  segments,
  totalLabel,
  onSelectSegment,
}: {
  segments: DonutSegment[];
  totalLabel: string;
  onSelectSegment?: (key: string) => void;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return <div className={styles.emptyState}>No data for this period yet.</div>;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.totalCaption}>
        {total.toLocaleString()} {totalLabel}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={segments}
            dataKey="value"
            nameKey="label"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            label={(entry: { value?: number }) => `${entry.value ?? 0}`}
            cursor={onSelectSegment ? 'pointer' : undefined}
            onClick={onSelectSegment ? (entry: DonutSegment) => onSelectSegment(entry.key) : undefined}
          >
            {segments.map((s) => (
              <Cell key={s.key} fill={s.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
            }}
            labelStyle={{ color: 'var(--color-text-primary)' }}
          />
          <Legend
            verticalAlign="bottom"
            height={32}
            formatter={(value: string) => <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
