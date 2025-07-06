export type TopicState = 'core' | 'active' | 'idle' | 'archived' | 'ephemeral';

// Add the missing type for backwards compatibility
import type { MetamemoryState as LegacyMetamemoryState } from '../../metamemory-old/types.js';

export interface VectorEmbeddings {
  [topicName: string]: {
    summary: string;
    embedding: number[];
  };
}

export interface MetamemoryState extends LegacyMetamemoryState {
  vectorEmbeddings?: VectorEmbeddings;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface TopicThread {
  name: string;
  state: TopicState;
  messages: Message[];
  summary: string;
  lastActiveTimestamp: number;
  createdAt: number;
  tokenCount: number;
  relationships?: string[]; // Related topic names
}

export interface TaggedMessage {
  messageId: string;
  topics: string[];
}

export interface TopicThreadStore {
  [topicName: string]: TopicThread;
}

export interface MetaMemoryConfig {
  maxTokensPerActiveThread: number;
  maxTokensPerIdleThread: number;
  inactivityThresholdMinutes: {
    activeToIdle: number;
    idleToArchived: number;
  };
  slidingWindowSize: number;
  compactionInterval: number;
  /**
   * Minimum number of queued messages before automatic processing
   */
  processingThreshold: number;
}

export interface CompactionLevel {
  level: 'light' | 'heavy' | 'archival';
  maxTokens: number;
  preserveLatestMessages: number;
}

export interface SummaryRequest {
  topicName: string;
  threadState: TopicState;
  reason: string;
  messages: Message[];
  level: CompactionLevel;
}

export interface ContextAssemblyOptions {
  maxTokens: number;
  includeIdleSummaries: boolean;
  includeArchivedSearch: boolean;
  recentMessageCount: number;
}

export interface VectorSearchResult {
  topicName: string;
  summary: string;
  relevanceScore: number;
}