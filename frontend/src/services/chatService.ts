import { axiosClient } from '@/api/axiosClient';
import { getSocket } from '@/api/socketClient';
import { useAuthStore } from '@/stores/authStore';
import { generateId } from '@/utils/id';
import { randomDelay } from './mock/delay';
import type { ChatMessage, Conversation, ConversationDetails } from '@/types';

interface BackendConversationSummary {
  _id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface BackendMessage {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed: string[];
  createdAt: string;
}

interface BackendConversation extends BackendConversationSummary {
  messages: BackendMessage[];
}

interface BackendChatResult {
  conversationId: string;
  reply: string;
  toolsUsed: string[];
}

function toConversation(c: BackendConversationSummary): Conversation {
  return {
    id: c._id,
    title: c.title,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    // The backend doesn't persist these yet — pin/favorite/archive are
    // session-local UI state until a real endpoint exists for them.
    pinned: false,
    favorite: false,
    archived: false,
    messageCount: 0,
  };
}

function toMessage(m: BackendMessage, conversationId: string, index: number): ChatMessage {
  return {
    id: `${conversationId}_${index}`,
    conversationId,
    role: m.role,
    content: m.content,
    status: 'complete',
    createdAt: m.createdAt,
    toolsUsed: m.toolsUsed?.length ? m.toolsUsed : undefined,
  };
}

export interface StreamController {
  stop: () => void;
}

export interface StreamCallbacks {
  onChunk: (accumulatedText: string) => void;
  onComplete: (message: ChatMessage, conversationId: string) => void;
  onError: (error: Error) => void;
}

export const chatService = {
  async getConversations(): Promise<Conversation[]> {
    const { data } = await axiosClient.get<BackendConversationSummary[]>('/chat/conversations');
    return data.map(toConversation).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  },

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const { data } = await axiosClient.get<BackendConversation>(`/chat/conversations/${conversationId}`);
    return (data.messages ?? []).map((m, i) => toMessage(m, conversationId, i));
  },

  /**
   * The backend has no "create empty conversation" endpoint — a conversation
   * only exists once the first message lands. This returns a client-only
   * placeholder id that chatStore uses as a temporary map key until the
   * server assigns the real one (see streamReply's onComplete).
   */
  async createConversation(): Promise<Conversation> {
    const now = new Date().toISOString();
    return {
      id: generateId('pending'),
      title: 'New conversation',
      createdAt: now,
      updatedAt: now,
      pinned: false,
      favorite: false,
      archived: false,
      messageCount: 0,
    };
  },

  async renameConversation(_id: string, _title: string): Promise<void> {
    // Not supported by the backend yet — the sidebar still updates its own
    // local state after this resolves, it just won't survive a reload.
  },

  async deleteConversation(_id: string): Promise<void> {
    // Same as renameConversation — local-only until a real endpoint exists.
  },

  async setConversationFlag(_id: string, _flag: 'pinned' | 'favorite' | 'archived', _value: boolean): Promise<void> {
    // Pin/favorite/archive are local-only (see toConversation above).
  },

  streamReply(conversationId: string, prompt: string, callbacks: StreamCallbacks, isNewConversation: boolean): StreamController {
    const token = useAuthStore.getState().accessToken ?? '';
    const socket = getSocket(token);
    if (!socket.connected) socket.connect();

    let settled = false;

    const onMessage = (result: BackendChatResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      const resolvedId = result.conversationId || conversationId;
      callbacks.onComplete(
        {
          id: generateId('msg'),
          conversationId: resolvedId,
          role: 'assistant',
          content: result.reply,
          status: 'complete',
          createdAt: new Date().toISOString(),
          toolsUsed: result.toolsUsed?.length ? result.toolsUsed : undefined,
        },
        resolvedId,
      );
    };

    const onError = (payload: { message: string }) => {
      if (settled) return;
      settled = true;
      cleanup();
      callbacks.onError(new Error(payload.message || 'The chat service returned an error.'));
    };

    function cleanup() {
      socket.off('message', onMessage);
      socket.off('error', onError);
    }

    socket.on('message', onMessage);
    socket.on('error', onError);
    socket.emit('message', { message: prompt, conversationId: isNewConversation ? undefined : conversationId });

    return {
      stop: () => {
        if (settled) return;
        settled = true;
        cleanup();
        callbacks.onComplete(
          {
            id: generateId('msg'),
            conversationId,
            role: 'assistant',
            content: '',
            status: 'stopped',
            createdAt: new Date().toISOString(),
          },
          conversationId,
        );
      },
    };
  },

  async submitFeedback(): Promise<void> {
    // Not persisted server-side yet — local UI state only.
  },

  // The conversation-intelligence side panel (referenced docs, knowledge
  // sources, memory context) has no real backend — Agentic RAG citations are
  // out of scope for this pass, so this stays mock-backed.
  async getConversationDetails(conversationId: string): Promise<ConversationDetails> {
    await randomDelay(200, 350);
    return {
      conversationId,
      referencedDocuments: [],
      knowledgeSources: [],
      connectedTools: [{ id: 'tool_default', name: 'Outlook / Microsoft Graph', status: 'idle' }],
      promptVariables: {},
      stats: { messages: 0, tokensUsed: 0, avgResponseTimeMs: 0, cost: 0 },
      agentStatus: 'idle',
      memoryContext: [],
    };
  },
};
