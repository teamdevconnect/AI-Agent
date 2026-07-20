import { useQuery } from '@tanstack/react-query';
import { FiFileText, FiBookOpen, FiTool, FiActivity, FiCpu } from 'react-icons/fi';
import { Badge, Skeleton } from '@/components/ui';
import { chatService } from '@/services/chatService';
import { formatDuration, formatCurrency, formatNumber } from '@/utils/format';
import styles from './RightPanel.module.css';

export function RightPanel({ conversationId }: { conversationId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['conversation-details', conversationId],
    queryFn: () => chatService.getConversationDetails(conversationId),
  });

  if (isLoading || !data) {
    return (
      <aside className={styles.panel}>
        <Skeleton height={100} />
        <Skeleton height={100} />
        <Skeleton height={100} />
      </aside>
    );
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.section}>
        <span className={styles.sectionTitle}>
          <FiActivity style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Agent Status
        </span>
        <Badge variant="success" dot>
          {data.agentStatus === 'idle' ? 'Idle — ready' : data.agentStatus}
        </Badge>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Conversation Statistics</span>
        <div className={styles.statsGrid}>
          <div className={styles.statTile}>
            <div className={styles.statValue}>{data.stats.messages}</div>
            <div className={styles.statLabel}>Messages</div>
          </div>
          <div className={styles.statTile}>
            <div className={styles.statValue}>{formatNumber(data.stats.tokensUsed)}</div>
            <div className={styles.statLabel}>Tokens used</div>
          </div>
          <div className={styles.statTile}>
            <div className={styles.statValue}>{formatDuration(data.stats.avgResponseTimeMs)}</div>
            <div className={styles.statLabel}>Avg response</div>
          </div>
          <div className={styles.statTile}>
            <div className={styles.statValue}>{formatCurrency(data.stats.cost)}</div>
            <div className={styles.statLabel}>Est. cost</div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>
          <FiFileText style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Referenced Documents
        </span>
        {data.referencedDocuments.map((doc) => (
          <div key={doc.id} className={styles.listItem}>
            <span className={styles.listItemName}>{doc.name}</span>
            <Badge variant="accent">{Math.round(doc.relevance * 100)}%</Badge>
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>
          <FiBookOpen style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Knowledge Sources
        </span>
        {data.knowledgeSources.map((source) => (
          <div key={source.id} className={styles.listItem}>
            <span className={styles.listItemName}>{source.name}</span>
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>
          <FiTool style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Connected Tools
        </span>
        {data.connectedTools.map((tool) => (
          <div key={tool.id} className={styles.listItem}>
            <span className={styles.listItemName}>{tool.name}</span>
            <Badge variant={tool.status === 'active' ? 'success' : 'neutral'} dot>
              {tool.status}
            </Badge>
          </div>
        ))}
      </div>

      {Object.keys(data.promptVariables).length > 0 && (
        <div className={styles.section}>
          <span className={styles.sectionTitle}>Prompt Variables</span>
          {Object.entries(data.promptVariables).map(([key, value]) => (
            <div key={key} className={styles.variableRow}>
              <span className={styles.variableKey}>{`{{${key}}}`}</span>
              <span className={styles.variableValue}>{value}</span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.section}>
        <span className={styles.sectionTitle}>
          <FiCpu style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Memory Context
        </span>
        {data.memoryContext.map((memory) => (
          <div key={memory} className={styles.memoryItem}>
            {memory}
          </div>
        ))}
      </div>
    </aside>
  );
}
