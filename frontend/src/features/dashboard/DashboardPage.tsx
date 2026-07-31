import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Avatar, Badge, Card, Skeleton } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { dashboardService } from '@/services/dashboardService';
import { PRIORITY_VARIANT } from './priorityVariant';
import { AgentComparisonChart } from './components/AgentComparisonChart';
import { AgentFocusedView } from './components/AgentFocusedView';
import { StatTile } from './components/StatTile';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'urgent' | 'overdue' | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => dashboardService.getOverview(),
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className={styles.page}>
        <Skeleton height={100} />
        <Skeleton height={160} />
        <Skeleton height={160} />
      </div>
    );
  }

  // RBAC already guarantees an agent_user's unscoped overview has exactly
  // one agent — land them straight in the focused view, no click needed.
  // Same for an admin viewing a workspace that only has one agent total.
  const isFocused = selectedAgentId !== null || data.agents.length === 1;
  if (isFocused) {
    const focusedAgentId = selectedAgentId ?? data.agents[0].id;
    return (
      <AgentFocusedView
        agentId={focusedAgentId}
        onBack={selectedAgentId ? () => setSelectedAgentId(null) : undefined}
      />
    );
  }

  // Falls back to a readable placeholder, never the raw id — same
  // convention as UsersSettings.tsx's agentName/storeName helpers.
  const agentName = (agentId: string) => data.agents.find((a) => a.id === agentId)?.name ?? 'Unknown agent';

  const visibleAlerts = data.criticalAlerts.filter((t) => {
    if (activeFilter === 'urgent') return t.priority === 'urgent';
    if (activeFilter === 'overdue') return t.isOverdue;
    return true;
  });

  return (
    <div className={styles.page}>
      <div>
        <div className={styles.pageTitle}>AI Workforce Dashboard</div>
        <div className={styles.pageSubtitle}>{data.date}</div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Today's Overview</span>
        <div className={styles.statsGrid}>
          <StatTile value={data.stats.totalTasks} label="Total Tasks" active={activeFilter === null} onClick={() => setActiveFilter(null)} />
          <StatTile
            value={data.stats.urgentCount}
            label="Urgent"
            active={activeFilter === 'urgent'}
            onClick={() => setActiveFilter((f) => (f === 'urgent' ? null : 'urgent'))}
          />
          <StatTile
            value={data.stats.overdueCount}
            label="Overdue"
            active={activeFilter === 'overdue'}
            onClick={() => setActiveFilter((f) => (f === 'overdue' ? null : 'overdue'))}
          />
          <StatTile value={data.stats.reportsGenerated} label="Reports Generated" />
          <StatTile
            value={data.stats.followUpHealthPct === null ? '—' : `${data.stats.followUpHealthPct}%`}
            label="Follow-up Health"
          />
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>AI Agents</span>
        <AgentComparisonChart agents={data.agents} onSelect={setSelectedAgentId} />
        <div className={styles.agentsGrid}>
          {data.agents.map((agent) => (
            <Card
              key={agent.id}
              interactive
              className={styles.agentCard}
              onClick={() => setSelectedAgentId(agent.id)}
            >
              <div className={styles.agentCardHeader}>
                <Avatar name={agent.name} color={agent.avatarColor} size="sm" />
                <span className={styles.agentName}>{agent.name}</span>
              </div>
              <Badge variant={agent.status === 'reported' ? 'success' : 'neutral'} dot>
                {agent.status === 'reported' ? 'Reported today' : 'Pending'}
              </Badge>
              <span className={styles.agentTaskCount}>{agent.todaysTaskCount} task(s) today</span>
            </Card>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>
          Critical Alerts{activeFilter && ` — ${activeFilter === 'urgent' ? 'Urgent' : 'Overdue'} only`}
        </span>
        {visibleAlerts.length === 0 ? (
          <div className={styles.emptyState}>
            {activeFilter ? `No ${activeFilter} items today.` : 'No urgent or overdue items today.'}
          </div>
        ) : (
          visibleAlerts.map((task, index) => (
            <div key={index} className={styles.listItem}>
              <div className={styles.listItemMain}>
                <span className={styles.listItemTitle}>{task.title}</span>
                <span className={styles.listItemMeta}>{agentName(task.agentId)}</span>
              </div>
              <Badge variant={PRIORITY_VARIANT[task.priority]}>{task.isOverdue ? 'Overdue' : task.priority}</Badge>
            </div>
          ))
        )}
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Recent Reports</span>
        {data.recentReports.length === 0 ? (
          <div className={styles.emptyState}>No reports generated yet today.</div>
        ) : (
          data.recentReports.map((report) => (
            <Link key={report.id} to={ROUTES.chatConversation(report.sourceConversationId)} className={styles.listItem}>
              <div className={styles.listItemMain}>
                <span className={styles.listItemTitle}>
                  {agentName(report.agentId)} — {report.reportType === 'morning' ? 'Morning to-do' : 'EOD report'}
                </span>
                <span className={styles.listItemMeta}>{report.summary}</span>
              </div>
              <Badge variant="neutral">{report.taskCount} tasks</Badge>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
