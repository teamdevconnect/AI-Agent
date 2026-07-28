import { useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { FiArrowDown } from 'react-icons/fi';
import { IconButton, Skeleton } from '@/components/ui';
import type { ChatMessage } from '@/types';
import { MessageBubble } from './MessageBubble';
<<<<<<< HEAD
import { TypingIndicator } from './TypingIndicator';
=======
>>>>>>> 6a60a8648 (Initial AI Agent source code)
import styles from '../ChatPage.module.css';

export interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
<<<<<<< HEAD
  showTypingIndicator: boolean;
}

export function MessageList({ messages, isLoading, showTypingIndicator }: MessageListProps) {
=======
}

export function MessageList({ messages, isLoading }: MessageListProps) {
>>>>>>> 6a60a8648 (Initial AI Agent source code)
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [atBottom, setAtBottom] = useState(true);

  const scrollToBottom = () => {
    virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className={styles.messagesInner}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Skeleton variant="circle" width={32} height={32} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skeleton variant="text" width="30%" />
              <Skeleton height={60} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <Virtuoso
        ref={virtuosoRef}
        style={{ height: '100%' }}
        data={messages}
        followOutput="smooth"
        atBottomStateChange={setAtBottom}
        components={{
          Header: () => <div style={{ height: 'var(--space-6)' }} />,
<<<<<<< HEAD
          Footer: () => (showTypingIndicator ? <TypingIndicator /> : <div style={{ height: 'var(--space-6)' }} />),
=======
          Footer: () => <div style={{ height: 'var(--space-6)' }} />,
>>>>>>> 6a60a8648 (Initial AI Agent source code)
        }}
        itemContent={(index, message) => (
          <div className={styles.messagesInner} style={{ paddingTop: 0, paddingBottom: 'var(--space-5)' }}>
            <MessageBubble message={message} isLast={index === messages.length - 1} />
          </div>
        )}
      />
      {!atBottom && (
        <div className={styles.scrollToBottom}>
          <IconButton
            className={styles.scrollToBottomButton}
            icon={<FiArrowDown />}
            label="Scroll to latest"
            onClick={scrollToBottom}
            style={{ background: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-strong)' }}
          />
        </div>
      )}
    </div>
  );
}
