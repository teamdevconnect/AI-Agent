import { create } from 'zustand';
import { chatService, type StreamController } from '@/services/chatService';
import { generateId } from '@/utils/id';
import type { ChatMessage, Conversation } from '@/types';

export type ConversationFilter = 'all' | 'pinned' | 'favorites' | 'archived';

interface ChatState {
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
  activeConversationId: string | null;
  streamingConversationId: string | null;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  searchQuery: string;
  filter: ConversationFilter;
  streamController: StreamController | null;

  loadConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  startNewConversation: () => void;
  sendMessage: (text: string) => Promise<void>;
  stopGeneration: () => void;
  regenerate: () => Promise<void>;
  toggleConversationFlag: (id: string, flag: 'pinned' | 'favorite' | 'archived') => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setFilter: (filter: ConversationFilter) => void;
  setMessageFeedback: (messageId: string, feedback: 'up' | 'down') => void;
}

/**
 * Streams a reply under `workingId` (either the real conversation id, or a
 * client-only placeholder for a brand-new conversation whose real id the
 * server only assigns once the first message completes). When the server
 * hands back a different id, this rekeys the message map and conversations
 * list from the placeholder to the real one.
 */
function streamAssistantReply(
  set: (partial: Partial<ChatState> | ((state: ChatState) => Partial<ChatState>)) => void,
  workingId: string,
  prompt: string,
  isNewConversation: boolean,
) {
  const placeholderId = generateId('msg');
  set((state) => ({
    messages: {
      ...state.messages,
      [workingId]: [
        ...(state.messages[workingId] ?? []),
        { id: placeholderId, conversationId: workingId, role: 'assistant', content: '', status: 'streaming', createdAt: new Date().toISOString() },
      ],
    },
    streamingConversationId: workingId,
  }));

  const controller = chatService.streamReply(
    workingId,
    prompt,
    {
      onChunk: (accumulated) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [workingId]: (state.messages[workingId] ?? []).map((m) =>
              m.id === placeholderId ? { ...m, content: accumulated } : m,
            ),
          },
        }));
      },
      onComplete: (message, finalId) => {
        set((state) => {
          const resolvedId = finalId || workingId;
          const finalized = (state.messages[workingId] ?? []).map((m) =>
            m.id === placeholderId
              ? { ...message, id: placeholderId, conversationId: resolvedId }
              : { ...m, conversationId: resolvedId },
          );

          const messages = { ...state.messages };
          if (resolvedId !== workingId) delete messages[workingId];
          messages[resolvedId] = finalized;

          const now = new Date().toISOString();
          const conversations = isNewConversation
            ? [
                {
                  id: resolvedId,
                  title: prompt.slice(0, 48),
                  createdAt: now,
                  updatedAt: now,
                  pinned: false,
                  favorite: false,
                  archived: false,
                  messageCount: finalized.length,
                },
                ...state.conversations,
              ]
            : state.conversations.map((c) =>
                c.id === workingId ? { ...c, updatedAt: now, messageCount: finalized.length } : c,
              );

          return {
            messages,
            streamingConversationId: null,
            streamController: null,
            activeConversationId: resolvedId,
            conversations,
          };
        });
      },
      onError: () => {
        set({ streamingConversationId: null, streamController: null });
      },
    },
    isNewConversation,
  );

  set({ streamController: controller });
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: {},
  activeConversationId: null,
  streamingConversationId: null,
  isLoadingConversations: false,
  isLoadingMessages: false,
  searchQuery: '',
  filter: 'all',
  streamController: null,

  async loadConversations() {
    set({ isLoadingConversations: true });
    const conversations = await chatService.getConversations();
    set({ conversations, isLoadingConversations: false });
  },

  async selectConversation(id) {
    set({ activeConversationId: id, isLoadingMessages: true });
    const messages = await chatService.getMessages(id);
    set((state) => ({ messages: { ...state.messages, [id]: messages }, isLoadingMessages: false }));
  },

  startNewConversation() {
    set({ activeConversationId: null });
  },

  async sendMessage(text) {
    const { activeConversationId } = get();
    const isNewConversation = !activeConversationId;

    let workingId = activeConversationId;
    if (!workingId) {
      const conversation = await chatService.createConversation();
      workingId = conversation.id;
    }

    const userMessage: ChatMessage = {
      id: generateId('msg'),
      conversationId: workingId,
      role: 'user',
      content: text,
      status: 'complete',
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      messages: { ...state.messages, [workingId]: [...(state.messages[workingId] ?? []), userMessage] },
      // Reflect the working id immediately so the UI (welcome screen vs.
      // message list) switches over even before the server responds.
      activeConversationId: workingId,
    }));

    streamAssistantReply(set, workingId, text, isNewConversation);
  },

  stopGeneration() {
    get().streamController?.stop();
  },

  async regenerate() {
    const { activeConversationId, messages } = get();
    if (!activeConversationId) return;
    const list = messages[activeConversationId] ?? [];
    const lastUserMessage = [...list].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) return;
    const trimmed = list[list.length - 1]?.role === 'assistant' ? list.slice(0, -1) : list;
    set((state) => ({
      messages: { ...state.messages, [activeConversationId]: trimmed },
    }));
    streamAssistantReply(set, activeConversationId, lastUserMessage.content, false);
  },

  async toggleConversationFlag(id, flag) {
    const conversation = get().conversations.find((c) => c.id === id);
    if (!conversation) return;
    const value = !conversation[flag];
    await chatService.setConversationFlag(id, flag, value);
    set((state) => ({
      conversations: state.conversations.map((c) => (c.id === id ? { ...c, [flag]: value } : c)),
    }));
  },

  async renameConversation(id, title) {
    await chatService.renameConversation(id, title);
    set((state) => ({ conversations: state.conversations.map((c) => (c.id === id ? { ...c, title } : c)) }));
  },

  async deleteConversation(id) {
    await chatService.deleteConversation(id);
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
    }));
  },

  setSearchQuery(query) {
    set({ searchQuery: query });
  },

  setFilter(filter) {
    set({ filter });
  },

  setMessageFeedback(messageId, feedback) {
    const { activeConversationId, messages } = get();
    if (!activeConversationId) return;
    set({
      messages: {
        ...messages,
        [activeConversationId]: (messages[activeConversationId] ?? []).map((m) =>
          m.id === messageId ? { ...m, feedback: m.feedback === feedback ? null : feedback } : m,
        ),
      },
    });
    void chatService.submitFeedback();
  },
}));
