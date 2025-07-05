import type { ResponseInputItem, Agent } from '@just-every/ensemble';
import { MessageProcessor } from './processor.js';
import { ThreadSummarizer } from './summarizer.js';
import { HistoryCompactor } from './compactor.js';
import type {
  MetamemoryState,
  MetamemoryOptions,
  ProcessingTrigger,
  CompactionOptions,
  CompactionResult,
} from './types.js';

export * from './types.js';

export class Metamemory {
  private processor: MessageProcessor;
  private summarizer: ThreadSummarizer;
  private compactor: HistoryCompactor;
  private options: MetamemoryOptions;
  
  constructor(options: MetamemoryOptions = {}) {
    this.options = options;
    this.processor = new MessageProcessor(options);
    this.summarizer = new ThreadSummarizer(options);
    this.compactor = new HistoryCompactor(options);
  }

  /**
   * Initialize a new metamemory state
   */
  static initializeState(): MetamemoryState {
    return {
      metamemory: new Map(),
      threads: new Map(),
      lastProcessedIndex: 0,
      lastProcessedTime: Date.now()
    };
  }

  /**
   * Process messages to update thread assignments
   */
  async processMessages(
    messages: ResponseInputItem[],
    state: MetamemoryState,
    agent: Agent,
    trigger?: ProcessingTrigger
  ): Promise<MetamemoryState> {
    return await this.processor.processMessages(messages, state, agent, trigger);
  }

  /**
   * Generate summaries for threads
   */
  async summarizeThreads(
    state: MetamemoryState,
    messages: ResponseInputItem[],
    agent: Agent,
    threadIds?: string[]
  ): Promise<MetamemoryState> {
    const updatedThreads = await this.summarizer.summarizeThreads(
      state,
      messages,
      agent,
      threadIds
    );

    return {
      ...state,
      threads: updatedThreads
    };
  }

  /**
   * Compact message history based on metamemory
   */
  async compactHistory(
    messages: ResponseInputItem[],
    state: MetamemoryState,
    options?: CompactionOptions
  ): Promise<CompactionResult> {
    return await this.compactor.compactHistory(messages, state, options);
  }

  /**
   * Check if processing should be triggered
   */
  shouldProcess(
    messages: ResponseInputItem[],
    state: MetamemoryState,
    lastMessageSize?: number
  ): ProcessingTrigger | null {
    const messagesSinceLastProcess = messages.length - state.lastProcessedIndex;
    const timeSinceLastProcess = Date.now() - state.lastProcessedTime;

    // Check interval trigger
    if (messagesSinceLastProcess >= (this.options.processInterval || 5)) {
      return { type: 'interval' };
    }

    // Check large message trigger
    if (lastMessageSize && lastMessageSize > 2000) {
      return { type: 'large_message', threshold: lastMessageSize };
    }

    // Check time gap trigger
    if (timeSinceLastProcess > 60000) { // 1 minute
      return { type: 'time_gap', threshold: timeSinceLastProcess };
    }

    return null;
  }
}

// Convenience functions for standalone use

/**
 * Initialize metamemory system with options
 */
export function initializeMetamemory(options?: MetamemoryOptions): Metamemory {
  return new Metamemory(options);
}

/**
 * Process messages and return updated state
 */
export async function processMessages(
  messages: ResponseInputItem[],
  state: MetamemoryState,
  agent: Agent,
  options?: MetamemoryOptions,
  trigger?: ProcessingTrigger
): Promise<MetamemoryState> {
  const metamemory = new Metamemory(options);
  return await metamemory.processMessages(messages, state, agent, trigger);
}

/**
 * Summarize threads and return updated state
 */
export async function summarizeThreads(
  state: MetamemoryState,
  messages: ResponseInputItem[],
  agent: Agent,
  options?: MetamemoryOptions,
  threadIds?: string[]
): Promise<MetamemoryState> {
  const metamemory = new Metamemory(options);
  return await metamemory.summarizeThreads(state, messages, agent, threadIds);
}

/**
 * Compact message history
 */
export async function compactHistory(
  messages: ResponseInputItem[],
  state: MetamemoryState,
  compactionOptions?: CompactionOptions,
  metamemoryOptions?: MetamemoryOptions
): Promise<CompactionResult> {
  const metamemory = new Metamemory(metamemoryOptions);
  return await metamemory.compactHistory(messages, state, compactionOptions);
}

/**
 * Create an empty metamemory state
 */
export function createMetamemoryState(): MetamemoryState {
  return Metamemory.initializeState();
}