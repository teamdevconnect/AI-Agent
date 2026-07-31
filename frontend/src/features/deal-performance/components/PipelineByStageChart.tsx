import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatStageLabel } from '@/utils/stageLabel';
import styles from './PipelineByStageChart.module.css';

export interface StageDatum {
  stageId: string;
  value: number;
}

// Reused for both the pipeline-by-stage widget and the conversion-funnel
// widget — a single-hue horizontal bar, not a multi-color FunnelChart. A
// real FunnelChart would visually imply a confirmed, ordered stage sequence
// this CRM doesn't have (no Pipeline/Stage schema exists); this is an
// explicitly-labeled approximation instead (see `caption`). Bars are
// clickable when `onSelect` is passed, drilling into that stage's deals.
export function PipelineByStageChart({
  data,
  caption,
  valueLabel,
  onSelect,
}: {
  data: StageDatum[];
  caption?: string;
  valueLabel: string;
  onSelect?: (stageId: string) => void;
}) {
  const chartData = data.map((d) => ({ ...d, label: formatStageLabel(d.stageId) }));

  return (
    <div className={styles.wrapper}>
      <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 36)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis type="number" stroke="var(--color-text-muted)" fontSize={12} allowDecimals={false} />
          <YAxis type="category" dataKey="label" stroke="var(--color-text-muted)" fontSize={12} width={110} />
          <Tooltip
            formatter={(v: number) => v.toLocaleString()}
            contentStyle={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
            }}
            labelStyle={{ color: 'var(--color-text-primary)' }}
          />
          <Bar
            dataKey="value"
            name={valueLabel}
            fill="var(--brand-accent-primary)"
            radius={[0, 4, 4, 0]}
            cursor={onSelect ? 'pointer' : undefined}
            onClick={onSelect ? (point: StageDatum) => onSelect(point.stageId) : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
      {caption && <span className={styles.caption}>{caption}</span>}
    </div>
  );
}
