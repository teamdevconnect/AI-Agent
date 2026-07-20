import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiFileText, FiMail, FiBarChart2, FiCode } from 'react-icons/fi';
import { useChatStore } from '@/stores/chatStore';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { mockPromptSuggestions } from '@/services/mock/fixtures/chat';
import { ROUTES } from '@/constants/routes';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { RightPanel } from './components/RightPanel';
import styles from './ChatPage.module.css';
import type { ChatMessage } from '@/types';

// Stable reference so the zustand selector below never returns a fresh []
// on every call — a new-array-per-call selector defeats useSyncExternalStore's
// identity check and causes an infinite render loop.
const EMPTY_MESSAGES: ChatMessage[] = [];

const SUGGESTION_ICONS: Record<string, ReactElement> = {
  'file-text': <FiFileText />,
  mail: <FiMail />,
  'bar-chart': <FiBarChart2 />,
  code: <FiCode />,
};

export function ChatPage() {
  const params = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [prefillText, setPrefillText] = useState<string | undefined>();

  useEffect(() => {
    const outlookResult = searchParams.get('outlook');
    if (!outlookResult) return;
    if (outlookResult === 'connected') toast.success('Outlook connected');
    else if (outlookResult === 'error') toast.error('Outlook connection failed — please try again.');
    searchParams.delete('outlook');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const selectConversation = useChatStore((state) => state.selectConversation);
  const startNewConversation = useChatStore((state) => state.startNewConversation);
  const isLoadingMessages = useChatStore((state) => state.isLoadingMessages);
  const streamingConversationId = useChatStore((state) => state.streamingConversationId);
  const messages = useChatStore((state) =>
    state.activeConversationId ? (state.messages[state.activeConversationId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES,
  );
  const sendMessage = useChatStore((state) => state.sendMessage);

  const rightPanelOpen = useUiStore((state) => state.rightPanelOpen);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (params.conversationId && params.conversationId !== activeConversationId) {
      void selectConversation(params.conversationId);
    } else if (!params.conversationId && activeConversationId) {
      startNewConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.conversationId]);

  useEffect(() => {
    if (activeConversationId && activeConversationId !== params.conversationId) {
      navigate(ROUTES.chatConversation(activeConversationId), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  const isStreamingCurrent = streamingConversationId !== null && streamingConversationId === activeConversationId;
  const lastMessage = messages[messages.length - 1];
  const showTypingIndicator = isStreamingCurrent && (!lastMessage || lastMessage.content === '');

  const handleSuggestionClick = (prompt: string) => {
    if (!activeConversationId) {
      setPrefillText(prompt);
    } else {
      void sendMessage(prompt);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.conversationColumn}>
        {activeConversationId ? (
          <div className={styles.messageArea}>
            <MessageList messages={messages} isLoading={isLoadingMessages} showTypingIndicator={showTypingIndicator} />
          </div>
        ) : (
          <div className={styles.messageArea}>
            <motion.div className={styles.welcome} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div>
                <h1 className={styles.welcomeTitle}>Hi {user?.firstName ?? 'there'}, what should we work on?</h1>
                <p className={styles.welcomeSubtitle}>
                  Ask a question, paste a document, or pick a suggestion below to get started with your AI workspace.
                </p>
              </div>
              <div className={styles.suggestionsGrid}>
                {mockPromptSuggestions.map((suggestion) => (
                  <button key={suggestion.id} type="button" className={styles.suggestionCard} onClick={() => handleSuggestionClick(suggestion.prompt)}>
                    <span className={styles.suggestionIcon}>{SUGGESTION_ICONS[suggestion.icon] ?? <FiFileText />}</span>
                    <span>
                      <div className={styles.suggestionTitle}>{suggestion.title}</div>
                      <div>{suggestion.prompt}</div>
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        <div className={styles.inputArea}>
          <ChatInput prefillText={prefillText} onPrefillConsumed={() => setPrefillText(undefined)} />
        </div>
      </div>

      {rightPanelOpen && activeConversationId && <RightPanel conversationId={activeConversationId} />}
    </div>
  );
}
