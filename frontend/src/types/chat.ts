export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error' | 'stopped';

export type FeedbackVote = 'up' | 'down' | null;

export interface MessageAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  kind: 'image' | 'document' | 'other';
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  createdAt: string;
  attachments?: MessageAttachment[];
  toolsUsed?: string[];
  feedback?: FeedbackVote;
  editedAt?: string;
  model?: string;
}

export type ConversationGroupKey = 'today' | 'yesterday' | 'lastWeek' | 'older';

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  agentId?: string;
  messageCount: number;
  preview?: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  avatarColor: string;
  model: string;
  personality: string;
  instructions: string;
  knowledgeSources: string[];
  connectedTools: string[];
  status: 'active' | 'draft' | 'disabled';
}

export interface SlashCommand {
  id: string;
  command: string;
  label: string;
  description: string;
  icon: string;
}

export interface PromptSuggestion {
  id: string;
  title: string;
  prompt: string;
  icon: string;
}

export interface ConversationDetails {
  conversationId: string;
  referencedDocuments: { id: string; name: string; relevance: number }[];
  knowledgeSources: { id: string; name: string }[];
  connectedTools: { id: string; name: string; status: 'active' | 'idle' }[];
  promptVariables: Record<string, string>;
  stats: { messages: number; tokensUsed: number; avgResponseTimeMs: number; cost: number };
  agentStatus: 'idle' | 'thinking' | 'responding' | 'using-tool';
  memoryContext: string[];
}
