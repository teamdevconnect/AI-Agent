import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FiActivity, FiArrowLeft, FiBarChart2, FiFileText, FiTrendingUp } from 'react-icons/fi';
import { Avatar, Badge, Button, SectionCard, Skeleton, Tabs } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { dashboardService } from '@/services/dashboardService';
import { PRIORITY_VARIANT } from '../priorityVariant';
import { StatTile } from './StatTile';
import { TaskTrendChart } from './TaskTrendChart';
import styles from './AgentFocusedView.module.css';

const RANGE_TABS = [
  { id: '7', label: '7 Days' },
  { id: '30', label: '30 Days' },
];

export function AgentFocusedView({ agentId, onBack }: { agentId: string; onBack?: () => void }) {
  const [range, setRange] = useState<7 | 30>(7);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-overview', agentId],
    queryFn: () => dashboardService.getOverview(agentId),
  });
  const { data: trend } = useQuery({
    queryKey: ['dashboard-trend', agentId, range],
    queryFn: () => dashboardService.getTrend(agentId, range),
  });

  if (isLoading || !data) {
    return (
      <div className={styles.page}>
        <Skeleton height={80} />
        <Skeleton height={160} />
        <Skeleton height={220} />
      </div>
    );
  }

  const agent = data.agents[0];

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div className={styles.agentHeader}>
          {agent && <Avatar name={agent.name} color={agent.avatarColor} size="lg" />}
          <div>
            <div className={styles.agentName}>{agent?.name ?? 'Agent'}</div>
            {agent && (
              <Badge variant={agent.status === 'reported' ? 'success' : 'neutral'} dot>
                {agent.status === 'reported' ? 'Reported today' : 'Pending'}
              </Badge>
            )}
          </div>
        </div>
        {onBack && (
          <Button type="button" variant="ghost" leftIcon={<FiArrowLeft />} onClick={onBack}>
            All Agents
          </Button>
        )}
      </div>

      <SectionCard title="Today's Overview" icon={FiBarChart2}>
        <div className={styles.statsGrid}>
          <StatTile value={data.stats.totalTasks} label="Total Tasks" />
          <StatTile value={data.stats.urgentCount} label="Urgent" />
          <StatTile value={data.stats.overdueCount} label="Overdue" />
          <StatTile value={data.stats.reportsGenerated} label="Reports Generated" />
          <StatTile
            value={data.stats.followUpHealthPct === null ? '—' : `${data.stats.followUpHealthPct}%`}
            label="Follow-up Health"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Trend"
        icon={FiTrendingUp}
        action={<Tabs items={RANGE_TABS} activeId={String(range)} onChange={(id) => setRange(Number(id) as 7 | 30)} />}
      >
        {trend ? <TaskTrendChart points={trend.points} /> : <Skeleton height={200} />}
      </SectionCard>

      <SectionCard title="Critical Alerts" icon={FiActivity}>
        {data.criticalAlerts.length === 0 ? (
          <div className={styles.emptyState}>No urgent or overdue items today.</div>
        ) : (
          data.criticalAlerts.map((task, index) => (
            <div key={index} className={styles.listItem}>
              <div className={styles.listItemMain}>
                <span className={styles.listItemTitle}>{task.title}</span>
              </div>
              <Badge variant={PRIORITY_VARIANT[task.priority]}>{task.isOverdue ? 'Overdue' : task.priority}</Badge>
            </div>
          ))
        )}
      </SectionCard>

      <SectionCard title="Recent Reports" icon={FiFileText}>
        {data.recentReports.length === 0 ? (
          <div className={styles.emptyState}>No reports generated yet today.</div>
        ) : (
          data.recentReports.map((report) => (
            <Link key={report.id} to={ROUTES.chatConversation(report.sourceConversationId)} className={styles.listItem}>
              <div className={styles.listItemMain}>
                <span className={styles.listItemTitle}>
                  {report.reportType === 'morning' ? 'Morning to-do' : 'EOD report'}
                </span>
                <span className={styles.listItemMeta}>{report.summary}</span>
              </div>
              <Badge variant="neutral">{report.taskCount} tasks</Badge>
            </Link>
          ))
        )}
      </SectionCard>
    </div>
  );
}
