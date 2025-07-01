import type { ResponseInputItem } from '@just-every/ensemble';

export type ThreadClass = 'core' | 'active' | 'complete' | 'ephemeral';

export interface MetamemoryEntry {
  messageId: string;
  threadIds: string[];
  timestamp: number;
  messageLength: number;
  importance?: number;
  preserveVerbatim?: boolean;
}

export interface Thread {
  id: string;
  name: string;
  messages: string[];
  status: 'active' | 'complete' | 'paused';
  summary?: string;
  keyPoints?: string[];
  lastUpdated: number;
  class: ThreadClass;
  createdAt: number;
}

export interface ThreadAnalysis {
  messageId: string;
  threadIds: string[];
  confidence: number;
  suggestedNewThreads?: {
    name: string;
    reason: string;
  }[];
}

export interface ThreadOperations {
  create?: {
    id: string;
    name: string;
    initialMessages: string[];
  }[];
  merge?: {
    sourceThreads: string[];
    targetThread: string;
  }[];
  close?: string[];
}

export interface MessageAnalysisResult {
  messageAnalysis: ThreadAnalysis[];
  threadOperations?: ThreadOperations;
  reasoning?: string;
}

export interface ThreadSummaryResult {
  threadId: string;
  title: string;
  class: ThreadClass;
  keySummary: string;
  keyPoints: string[];
  status: 'active' | 'complete' | 'paused';
  importance: number;
}

export interface MetamemoryOptions {
  windowSize?: number;
  processInterval?: number;
  threadInactivityTimeout?: number;
  compactionThresholds?: {
    core?: number;
    active?: number;
    complete?: number;
    ephemeral?: number;
  };
  maxThreadsToTrack?: number;
  modelPreferences?: {
    analysis?: string;
    summarization?: string;
  };
  processingTimeout?: number; // Max time to wait for metamemory processing (ms)
}

export interface CompactedMessage {
  role: 'user' | 'assistant' | 'system' | 'developer';
  content: string;
  timestamp?: number;
  threadIds?: string[];
  isCompacted?: boolean;
  originalMessageIds?: string[];
}

export interface CompactionResult {
  messages: CompactedMessage[];
  metadata: {
    originalCount: number;
    compactedCount: number;
    threadsPreserved: string[];
    threadsSummarized: string[];
    originalTokens?: number;
    compactedTokens?: number;
  };
}

export type MetamemoryMap = Map<string, MetamemoryEntry>;
export type ThreadMap = Map<string, Thread>;

export interface MetamemoryState {
  metamemory: MetamemoryMap;
  threads: ThreadMap;
  lastProcessedIndex: number;
  lastProcessedTime: number;
}

export interface ProcessingTrigger {
  type: 'interval' | 'large_message' | 'time_gap' | 'manual';
  threshold?: number;
}

export interface MetamemoryProcessor {
  processMessages(
    messages: ResponseInputItem[],
    state: MetamemoryState,
    trigger?: ProcessingTrigger
  ): Promise<MetamemoryState>;
  
  summarizeThreads(
    state: MetamemoryState,
    threadIds?: string[]
  ): Promise<ThreadMap>;
  
  compactHistory(
    messages: ResponseInputItem[],
    state: MetamemoryState,
    options?: CompactionOptions
  ): Promise<CompactionResult>;
}

export interface CompactionOptions {
  targetTokenCount?: number;
  preserveThreadIds?: string[];
  aggressiveMode?: boolean;
  includeSystemMessages?: boolean;
}