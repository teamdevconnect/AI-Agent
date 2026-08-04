import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FiAlertTriangle, FiBarChart2, FiClipboard, FiClock, FiFileText, FiTrendingUp, FiUsers } from 'react-icons/fi';
import { Avatar, Badge, Card, SectionCard, Skeleton, Tabs } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { dashboardService } from '@/services/dashboardService';
import { PRIORITY_VARIANT } from './priorityVariant';
import { AgentComparisonChart } from './components/AgentComparisonChart';
import { AgentFocusedView } from './components/AgentFocusedView';
import { StatTile } from './components/StatTile';
import styles from './DashboardPage.module.css';

// Grouped into tabs so the 5 stat tiles + chart + agent grid + 2 unbounded
// lists don't all stack in one continuous scroll — the same crowding fix
// already proven on Deal Performance/Finance AI, applied here since this
// was confirmed the most crowded page in the app.
const TAB_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'agents', label: 'Agents' },
  { id: 'activity', label: 'Activity' },
];
const TAB_IDS = TAB_ITEMS.map((t) => t.id);

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'urgent' | 'overdue' | null>(null);
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(initialTab && TAB_IDS.includes(initialTab) ? initialTab : 'overview');

  const changeTab = (tab: string) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

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

      <div className={styles.tabBar}>
        <Tabs items={TAB_ITEMS} activeId={activeTab} onChange={changeTab} />
      </div>

      {activeTab === 'overview' && (
        <SectionCard title="Today's Overview" icon={FiBarChart2}>
          <div className={styles.statsGrid}>
            <StatTile
              value={data.stats.totalTasks}
              label="Total Tasks"
              icon={FiClipboard}
              active={activeFilter === null}
              onClick={() => setActiveFilter(null)}
            />
            <StatTile
              value={data.stats.urgentCount}
              label="Urgent"
              icon={FiAlertTriangle}
              active={activeFilter === 'urgent'}
              onClick={() => setActiveFilter((f) => (f === 'urgent' ? null : 'urgent'))}
            />
            <StatTile
              value={data.stats.overdueCount}
              label="Overdue"
              icon={FiClock}
              active={activeFilter === 'overdue'}
              onClick={() => setActiveFilter((f) => (f === 'overdue' ? null : 'overdue'))}
            />
            <StatTile value={data.stats.reportsGenerated} label="Reports Generated" icon={FiFileText} />
            <StatTile
              value={data.stats.followUpHealthPct === null ? '—' : `${data.stats.followUpHealthPct}%`}
              label="Follow-up Health"
              icon={FiTrendingUp}
            />
          </div>
        </SectionCard>
      )}

      {activeTab === 'agents' && (
        <>
          <SectionCard title="Performance Comparison" icon={FiBarChart2}>
            <AgentComparisonChart agents={data.agents} onSelect={setSelectedAgentId} />
          </SectionCard>

          <SectionCard title="Agent Status" icon={FiUsers}>
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
          </SectionCard>
        </>
      )}

      {activeTab === 'activity' && (
        <>
          <SectionCard
            title={`Critical Alerts${activeFilter ? ` — ${activeFilter === 'urgent' ? 'Urgent' : 'Overdue'} only` : ''}`}
            icon={FiAlertTriangle}
          >
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
          </SectionCard>

          <SectionCard title="Recent Reports" icon={FiFileText}>
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
          </SectionCard>
        </>
      )}
    </div>
  );
}
