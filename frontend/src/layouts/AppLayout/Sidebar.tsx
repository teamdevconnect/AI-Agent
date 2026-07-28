import { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  FiPlus,
  FiSearch,
  FiChevronsLeft,
  FiChevronsRight,
  FiBookmark,
  FiStar,
  FiArchive,
  FiMoreHorizontal,
  FiEdit2,
  FiTrash2,
  FiLogOut,
  FiUser,
  FiSun,
  FiMoon,
} from 'react-icons/fi';
import { Logo } from '@/components/common/Logo';
import { IconButton, Input, Avatar, Dropdown, Button } from '@/components/ui';
import { useUiStore } from '@/stores/uiStore';
import { useChatStore, type ConversationFilter } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from '@/constants/navigation';
import { ROUTES } from '@/constants/routes';
<<<<<<< HEAD
=======
import { hasRole } from '@/utils/roles';
>>>>>>> 6a60a8648 (Initial AI Agent source code)
import { getConversationGroup, CONVERSATION_GROUP_LABELS, type ConversationGroupKey } from '@/utils/date';
import type { Conversation } from '@/types';
import styles from './Sidebar.module.css';

const GROUP_ORDER: ConversationGroupKey[] = ['today', 'yesterday', 'lastWeek', 'older'];

const FILTERS: { id: ConversationFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pinned', label: 'Pinned' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'archived', label: 'Archived' },
];

export function Sidebar() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);

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

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

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

<<<<<<< HEAD
=======
  const visiblePrimaryNav = PRIMARY_NAV_ITEMS.filter((item) => !item.hideForRoles?.some((r) => hasRole(user, r)));
  const visibleSecondaryNav = SECONDARY_NAV_ITEMS.filter((item) => !item.hideForRoles?.some((r) => hasRole(user, r)));

>>>>>>> 6a60a8648 (Initial AI Agent source code)
  const handleNewChat = () => {
    startNewConversation();
    navigate(ROUTES.chat);
  };

  const handleRenameSubmit = (id: string) => {
    if (renameValue.trim()) void renameConversation(id, renameValue.trim());
    setRenamingId(null);
  };

  return (
    <aside className={clsx(styles.sidebar, collapsed && styles.collapsed)}>
      <div className={styles.header}>
        {!collapsed && <Logo />}
        <IconButton
          icon={collapsed ? <FiChevronsRight /> : <FiChevronsLeft />}
          label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleSidebar}
        />
      </div>

      <div className={styles.newChatRow}>
        {collapsed ? (
          <IconButton icon={<FiPlus />} label="New chat" onClick={handleNewChat} size="lg" />
        ) : (
          <Button variant="secondary" fullWidth leftIcon={<FiPlus />} onClick={handleNewChat}>
            New Chat
          </Button>
        )}
      </div>

      {!collapsed && (
        <div className={styles.searchRow}>
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<FiSearch />}
            aria-label="Search chats"
          />
        </div>
      )}

      <div className={styles.scrollArea}>
        {!collapsed && (
          <>
            <div className={styles.filterRow}>
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={clsx(styles.filterChip, filter === f.id && styles.filterChipActive)}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filtered.length === 0 && <p className={styles.emptyHint}>No conversations here yet.</p>}

            {GROUP_ORDER.map((groupKey) => {
              const items = grouped[groupKey];
              if (items.length === 0) return null;
              return (
                <div key={groupKey}>
                  <div className={styles.groupLabel}>{CONVERSATION_GROUP_LABELS[groupKey]}</div>
                  {items.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={clsx(styles.conversationItem, params.conversationId === conversation.id && styles.conversationItemActive)}
                    >
                      {renamingId === conversation.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameSubmit(conversation.id)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit(conversation.id)}
                          style={{ background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', width: '100%', outline: 'none' }}
                        />
                      ) : (
                        <button
                          type="button"
                          className={styles.conversationTitle}
                          style={{ all: 'unset', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                          onClick={() => navigate(ROUTES.chatConversation(conversation.id))}
                        >
                          {conversation.title}
                        </button>
                      )}
                      <span className={styles.conversationMeta}>
                        {conversation.pinned && <FiBookmark size={12} />}
                        {conversation.favorite && <FiStar size={12} />}
                      </span>
                      <span className={styles.conversationActions}>
                        <Dropdown
                          align="right"
                          trigger={<IconButton icon={<FiMoreHorizontal />} label="Conversation actions" size="sm" />}
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
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>

      <nav className={styles.navSection}>
<<<<<<< HEAD
        {PRIMARY_NAV_ITEMS.map((item) => (
=======
        {visiblePrimaryNav.map((item) => (
>>>>>>> 6a60a8648 (Initial AI Agent source code)
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => clsx(styles.navItem, isActive && styles.navItemActive)}
          >
            <item.icon className={styles.navIcon} />
            {!collapsed && item.label}
          </NavLink>
        ))}
<<<<<<< HEAD
        {SECONDARY_NAV_ITEMS.map((item) => (
=======
        {visibleSecondaryNav.map((item) => (
>>>>>>> 6a60a8648 (Initial AI Agent source code)
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => clsx(styles.navItem, isActive && styles.navItemActive)}
          >
            <item.icon className={styles.navIcon} />
            {!collapsed && item.label}
          </NavLink>
        ))}
      </nav>

      <div className={styles.footer}>
        <Dropdown
          align="left"
          placement="top"
          trigger={
            <button type="button" className={styles.userRow}>
              <Avatar name={user ? `${user.firstName} ${user.lastName}` : 'User'} size="sm" />
              {!collapsed && (
                <span className={styles.userText}>
                  <div className={styles.userName}>{user ? `${user.firstName} ${user.lastName}` : 'User'}</div>
                  <div className={styles.userEmail}>{user?.email}</div>
                </span>
              )}
            </button>
          }
          items={[
            { id: 'profile', label: 'Profile', icon: <FiUser />, onSelect: () => navigate(ROUTES.profile) },
            {
              id: 'theme',
              label: theme === 'dark' ? 'Light mode' : 'Dark mode',
              icon: theme === 'dark' ? <FiSun /> : <FiMoon />,
              onSelect: toggleTheme,
            },
            {
              id: 'logout',
              label: 'Logout',
              icon: <FiLogOut />,
              danger: true,
              separatorBefore: true,
              onSelect: () => {
                void logout();
                navigate(ROUTES.login);
              },
            },
          ]}
        />
      </div>
    </aside>
  );
}
