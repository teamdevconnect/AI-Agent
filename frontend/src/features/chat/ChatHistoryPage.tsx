import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { FiPlus, FiSearch, FiBookmark, FiStar, FiArchive, FiMoreHorizontal, FiEdit2, FiTrash2, FiMessageSquare } from 'react-icons/fi';
import { Card, Input, Dropdown, Button } from '@/components/ui';
import { useChatStore, type ConversationFilter } from '@/stores/chatStore';
import { ROUTES } from '@/constants/routes';
import { formatRelativeTime, getConversationGroup, CONVERSATION_GROUP_LABELS, type ConversationGroupKey } from '@/utils/date';
import type { Conversation } from '@/types';
import styles from './ChatHistoryPage.module.css';

const GROUP_ORDER: ConversationGroupKey[] = ['today', 'yesterday', 'lastWeek', 'older'];

const FILTERS: { id: ConversationFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pinned', label: 'Pinned' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'archived', label: 'Archived' },
];

// Full-page home for everything that used to live in the sidebar's cramped
// chat-history strip (SidebarChatSection, now removed) — same store, same
// actions, just room to actually read a conversation's preview and time.
export function ChatHistoryPage() {
  const conversations = useChatStore((state) => state.conversations);
  const filter = useChatStore((state) => state.filter);
  const setFilter = useChatStore((state) => state.setFilter);
  const searchQuery = useChatStore((state) => state.searchQuery);
  const setSearchQuery = useChatStore((state) => state.setSearchQuery);
  const loadConversations = useChatStore((state) => state.loadConversations);
  const toggleConversationFlag = useChatStore((state) => state.toggleConversationFlag);
  const renameConversation = useChatStore((state) => state.renameConversation);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const startNewConversation = useChatStore((state) => state.startNewConversation);

  const navigate = useNavigate();
  const params = useParams();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      if (filter === 'pinned' && !c.pinned) return false;
      if (filter === 'favorites' && !c.favorite) return false;
      if (filter === 'archived') {
        if (!c.archived) return false;
      } else if (c.archived) {
        return false;
      }
      if (searchQuery && !c.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [conversations, filter, searchQuery]);

  const grouped = useMemo(() => {
    const groups: Record<ConversationGroupKey, Conversation[]> = { today: [], yesterday: [], lastWeek: [], older: [] };
    for (const conversation of filtered) {
      groups[getConversationGroup(conversation.updatedAt)].push(conversation);
    }
    return groups;
  }, [filtered]);

  const handleNewChat = () => {
    startNewConversation();
    navigate(ROUTES.chat);
  };

  const handleOpenConversation = (id: string) => navigate(ROUTES.chatConversation(id));

  const handleRenameSubmit = (id: string) => {
    if (renameValue.trim()) void renameConversation(id, renameValue.trim());
    setRenamingId(null);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Chat History</div>
        <Button leftIcon={<FiPlus />} onClick={handleNewChat}>
          New conversation
        </Button>
      </div>

      <div className={styles.toolbar}>
        <Input
          placeholder="Search chats..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<FiSearch />}
          aria-label="Search chats"
        />
        <div className={styles.filterRow}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={clsx(styles.chip, filter === f.id && styles.chipActive)}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className={styles.emptyState}>
          <FiMessageSquare size={28} />
          <p>No conversations here yet.</p>
        </Card>
      ) : (
        GROUP_ORDER.map((groupKey) => {
          const items = grouped[groupKey];
          if (items.length === 0) return null;
          return (
            <div key={groupKey}>
              <div className={styles.groupLabel}>{CONVERSATION_GROUP_LABELS[groupKey]}</div>
              <Card padded={false} className={styles.groupCard}>
                {items.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={clsx(styles.item, params.conversationId === conversation.id && styles.itemActive)}
                  >
                    <FiMessageSquare className={styles.itemIcon} />
                    <div className={styles.itemMain}>
                      {renamingId === conversation.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameSubmit(conversation.id)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit(conversation.id)}
                          className={styles.renameInput}
                        />
                      ) : (
                        <button type="button" className={styles.itemTitle} onClick={() => handleOpenConversation(conversation.id)}>
                          {conversation.title}
                          {conversation.pinned && <FiBookmark size={12} />}
                          {conversation.favorite && <FiStar size={12} />}
                        </button>
                      )}
                      {conversation.preview && <div className={styles.itemPreview}>{conversation.preview}</div>}
                    </div>
                    <div className={styles.itemMeta}>{formatRelativeTime(conversation.updatedAt)}</div>
                    <Dropdown
                      usePortal
                      align="right"
                      trigger={<button type="button" className={styles.itemActions} aria-label="Conversation actions"><FiMoreHorizontal /></button>}
                      items={[
                        {
                          id: 'rename',
                          label: 'Rename',
                          icon: <FiEdit2 />,
                          onSelect: () => {
                            setRenamingId(conversation.id);
                            setRenameValue(conversation.title);
                          },
                        },
                        {
                          id: 'pin',
                          label: conversation.pinned ? 'Unpin' : 'Pin',
                          icon: <FiBookmark />,
                          onSelect: () => void toggleConversationFlag(conversation.id, 'pinned'),
                        },
                        {
                          id: 'favorite',
                          label: conversation.favorite ? 'Remove favorite' : 'Add to favorites',
                          icon: <FiStar />,
                          onSelect: () => void toggleConversationFlag(conversation.id, 'favorite'),
                        },
                        {
                          id: 'archive',
                          label: conversation.archived ? 'Unarchive' : 'Archive',
                          icon: <FiArchive />,
                          onSelect: () => void toggleConversationFlag(conversation.id, 'archived'),
                        },
                        {
                          id: 'delete',
                          label: 'Delete',
                          icon: <FiTrash2 />,
                          danger: true,
                          separatorBefore: true,
                          onSelect: () => void deleteConversation(conversation.id),
                        },
                      ]}
                    />
                  </div>
                ))}
              </Card>
            </div>
          );
        })
      )}
    </div>
  );
}
