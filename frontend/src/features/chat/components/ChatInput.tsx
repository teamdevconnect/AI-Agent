import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { FiPaperclip, FiImage, FiMic, FiSend, FiSquare, FiX, FiFile } from 'react-icons/fi';
import { IconButton, Tooltip } from '@/components/ui';
import { useAutosizeTextarea } from '@/hooks/useAutosizeTextarea';
import { useChatStore } from '@/stores/chatStore';
<<<<<<< HEAD
import { mockAgents, mockSlashCommands } from '@/services/mock/fixtures/chat';
import { formatBytes } from '@/utils/format';
import { generateId } from '@/utils/id';
import type { MessageAttachment } from '@/types';
=======
import { chatService } from '@/services/chatService';
import { mockSlashCommands } from '@/services/mock/fixtures/chat';
import { formatBytes } from '@/utils/format';
import { generateId } from '@/utils/id';
import type { ChatAgent, MessageAttachment } from '@/types';
>>>>>>> 6a60a8648 (Initial AI Agent source code)
import styles from './ChatInput.module.css';

type Popup = { type: 'slash'; query: string } | { type: 'mention'; query: string } | null;

export interface ChatInputProps {
  prefillText?: string;
  onPrefillConsumed?: () => void;
}

export function ChatInput({ prefillText, onPrefillConsumed }: ChatInputProps) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [focused, setFocused] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [popup, setPopup] = useState<Popup>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recording, setRecording] = useState(false);
<<<<<<< HEAD
=======
  const [agents, setAgents] = useState<ChatAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
>>>>>>> 6a60a8648 (Initial AI Agent source code)

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useAutosizeTextarea(textareaRef, text);

  useEffect(() => {
    if (!prefillText) return;
    setText(prefillText);
    textareaRef.current?.focus();
    onPrefillConsumed?.();
    // onPrefillConsumed intentionally excluded — including it would refire this effect
    // whenever the parent re-renders with a new inline callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillText]);

  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const streamingConversationId = useChatStore((state) => state.streamingConversationId);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const stopGeneration = useChatStore((state) => state.stopGeneration);

  const isStreamingCurrent = streamingConversationId !== null && streamingConversationId === activeConversationId;

<<<<<<< HEAD
=======
  useEffect(() => {
    chatService.getAgents().then(setAgents).catch(() => setAgents([]));
  }, []);

  // A freshly-typed @mention only applies to the next message being
  // composed — once sent, the conversation's persona becomes sticky
  // server-side (see chatStore's activeAgentId), so there's nothing left
  // for this local selection to do until the user starts a new/different
  // conversation.
  useEffect(() => {
    setSelectedAgentId(null);
  }, [activeConversationId]);

>>>>>>> 6a60a8648 (Initial AI Agent source code)
  const slashMatches = useMemo(() => {
    if (popup?.type !== 'slash') return [];
    return mockSlashCommands.filter((c) => c.command.slice(1).toLowerCase().startsWith(popup.query.toLowerCase()));
  }, [popup]);

  const mentionMatches = useMemo(() => {
    if (popup?.type !== 'mention') return [];
<<<<<<< HEAD
    return mockAgents.filter((a) => a.name.toLowerCase().includes(popup.query.toLowerCase()));
  }, [popup]);
=======
    return agents.filter((a) => a.name.toLowerCase().includes(popup.query.toLowerCase()));
  }, [popup, agents]);
>>>>>>> 6a60a8648 (Initial AI Agent source code)

  const popupItemCount = popup?.type === 'slash' ? slashMatches.length : popup?.type === 'mention' ? mentionMatches.length : 0;

  const detectTrigger = (value: string, cursor: number) => {
    const upToCursor = value.slice(0, cursor);
    const match = /(?:^|\s)([/@])(\w*)$/.exec(upToCursor);
    if (!match) {
      setPopup(null);
      return;
    }
    setActiveIndex(0);
    setPopup(match[1] === '/' ? { type: 'slash', query: match[2] } : { type: 'mention', query: match[2] });
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    detectTrigger(event.target.value, event.target.selectionStart ?? event.target.value.length);
  };

  const insertToken = (token: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? text.length;
    const upToCursor = text.slice(0, cursor);
    const replaced = upToCursor.replace(/(?:^|\s)([/@])(\w*)$/, (whole, trigger: string) => {
      const prefix = whole.startsWith(trigger) ? '' : whole[0];
      return `${prefix}${token} `;
    });
    const newText = replaced + text.slice(cursor);
    setText(newText);
    setPopup(null);
    requestAnimationFrame(() => el.focus());
  };

<<<<<<< HEAD
=======
  const selectAgentMention = (agent: ChatAgent) => {
    insertToken(`@${agent.name.replace(/\s+/g, '')}`);
    setSelectedAgentId(agent.id);
  };

>>>>>>> 6a60a8648 (Initial AI Agent source code)
  const handleSubmit = () => {
    if (isStreamingCurrent) return;
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
<<<<<<< HEAD
    void sendMessage(trimmed || 'Please review the attached file(s).');
=======
    void sendMessage(trimmed || 'Please review the attached file(s).', selectedAgentId ?? undefined);
>>>>>>> 6a60a8648 (Initial AI Agent source code)
    setText('');
    setAttachments([]);
    setPopup(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (popup && popupItemCount > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((i) => (i + 1) % popupItemCount);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((i) => (i - 1 + popupItemCount) % popupItemCount);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const safeIndex = Math.min(activeIndex, popupItemCount - 1);
        if (popup.type === 'slash') insertToken(slashMatches[safeIndex].command);
<<<<<<< HEAD
        else insertToken(`@${mentionMatches[safeIndex].name.replace(/\s+/g, '')}`);
=======
        else selectAgentMention(mentionMatches[safeIndex]);
>>>>>>> 6a60a8648 (Initial AI Agent source code)
        return;
      }
      if (event.key === 'Escape') {
        setPopup(null);
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const addFiles = (files: FileList | File[]) => {
    const next: MessageAttachment[] = Array.from(files).map((file) => ({
      id: generateId('att'),
      name: file.name,
      size: file.size,
      type: file.type,
      kind: file.type.startsWith('image/') ? 'image' : 'document',
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setAttachments((prev) => [...prev, ...next]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((a) => a.id !== id);
    });
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
  };

  const tokenEstimate = Math.ceil(text.length / 4);

  return (
    <div
      className={clsx(styles.container, focused && styles.containerFocused, dragOver && styles.dragOver)}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {popup && popupItemCount > 0 && (
        <div className={styles.popup} role="listbox">
          {popup.type === 'slash' &&
            slashMatches.map((cmd, index) => (
              <button
                key={cmd.id}
                type="button"
                className={clsx(styles.popupItem, index === activeIndex && styles.popupItemActive)}
                onClick={() => insertToken(cmd.command)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className={styles.popupItemIcon}>/</span>
                <span>
                  <div className={styles.popupItemLabel}>{cmd.label}</div>
                  <div className={styles.popupItemDescription}>{cmd.description}</div>
                </span>
              </button>
            ))}
          {popup.type === 'mention' &&
            mentionMatches.map((agent, index) => (
              <button
                key={agent.id}
                type="button"
                className={clsx(styles.popupItem, index === activeIndex && styles.popupItemActive)}
<<<<<<< HEAD
                onClick={() => insertToken(`@${agent.name.replace(/\s+/g, '')}`)}
=======
                onClick={() => selectAgentMention(agent)}
>>>>>>> 6a60a8648 (Initial AI Agent source code)
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className={styles.popupItemIcon} style={{ background: agent.avatarColor, color: '#fff' }}>
                  {agent.name[0]}
                </span>
                <span>
                  <div className={styles.popupItemLabel}>{agent.name}</div>
                  <div className={styles.popupItemDescription}>{agent.description}</div>
                </span>
              </button>
            ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div className={styles.attachmentsRow}>
          {attachments.map((attachment) => (
            <span key={attachment.id} className={styles.attachmentChip}>
              {attachment.kind === 'image' ? <FiImage /> : <FiFile />}
              <span className={styles.attachmentName}>{attachment.name}</span>
              <span>({formatBytes(attachment.size)})</span>
              <button type="button" className={styles.attachmentRemove} onClick={() => removeAttachment(attachment.id)} aria-label={`Remove ${attachment.name}`}>
                <FiX size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className={styles.textareaRow}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="Message HaiVE AI... use / for commands or @ to mention an agent"
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </div>

      <div className={styles.toolbarRow}>
        <div className={styles.toolbarLeft}>
          <Tooltip content="Attach files">
            <IconButton icon={<FiPaperclip />} label="Attach files" size="sm" onClick={() => fileInputRef.current?.click()} />
          </Tooltip>
          <Tooltip content="Attach images">
            <IconButton icon={<FiImage />} label="Attach images" size="sm" onClick={() => imageInputRef.current?.click()} />
          </Tooltip>
          <Tooltip content={recording ? 'Stop recording' : 'Voice input'}>
            <IconButton
              icon={<FiMic />}
              label="Voice input"
              size="sm"
              active={recording}
              className={recording ? styles.recording : undefined}
              onClick={() => {
                setRecording((prev) => !prev);
                toast('Voice input is a Phase 2 feature — recording UI only.');
              }}
            />
          </Tooltip>
          <input ref={fileInputRef} type="file" multiple className={styles.hiddenInput} onChange={(e) => e.target.files && addFiles(e.target.files)} />
          <input
            ref={imageInputRef}
            type="file"
            multiple
            accept="image/*"
            className={styles.hiddenInput}
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>
        <div className={styles.toolbarRight}>
          <span className={styles.tokenCounter}>~{tokenEstimate} tokens</span>
          {isStreamingCurrent ? (
            <IconButton icon={<FiSquare />} label="Stop generating" onClick={stopGeneration} style={{ background: 'var(--color-danger)', color: '#fff' }} />
          ) : (
            <IconButton
              icon={<FiSend />}
              label="Send message"
              onClick={handleSubmit}
              style={{ background: 'var(--gradient-accent)', color: '#fff' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
