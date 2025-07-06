import { 
  MetaMemoryConfig, 
  TopicThreadStore, 
  Message,
  ContextAssemblyOptions,
  MetamemoryState as MetamemoryStateType
} from './types/index.js';
import { TopicThreadManager } from './utils/topic-thread-manager.js';
import { MessageTagger, TaggerLLM } from './tagger/index.js';
import { LLMTagger } from './tagger/llm-tagger.js';
import { ThreadCompactor, SummarizerInterface } from './compactor/index.js';
import { LLMSummarizer } from './summarizer/index.js';
import { ContextAssembler, VectorSearchInterface } from './context/index.js';
import { InMemoryVectorSearch } from './utils/vector-search.js';
import type { ResponseInput, ResponseInputItem, Agent } from '@just-every/ensemble';

// Re-export types for backward compatibility
export type { MetamemoryState } from './types';

export interface MetaMemoryOptions {
  config?: Partial<MetaMemoryConfig>;
  vectorSearch?: VectorSearchInterface;
  taggerLLM?: TaggerLLM;
  summarizer?: SummarizerInterface;
  agent: Agent;
}

export class Metamemory {
  private threadManager: TopicThreadManager;
  private tagger: MessageTagger;
  private compactor: ThreadCompactor;
  private contextAssembler: ContextAssembler;
  private vectorSearch: InMemoryVectorSearch;
  private config: MetaMemoryConfig;
  private isProcessing: boolean = false;
  private messageQueue: ResponseInputItem[] = [];
  private lastProcessedIndex: number = 0;
  
  constructor(options: MetaMemoryOptions) {
    // Initialize config with defaults
    this.config = {
      maxTokensPerActiveThread: 20000,
      maxTokensPerIdleThread: 5000,
      inactivityThresholdMinutes: {
        activeToIdle: 60,
        idleToArchived: 1440 // 24 hours
      },
      slidingWindowSize: 20,
      compactionInterval: 300000, // 5 minutes
      processingThreshold: 5,
      ...options.config
    };
    
    // Initialize components
    this.threadManager = new TopicThreadManager();
    
    const taggerLLM = options.taggerLLM || new LLMTagger(options.agent);
    this.tagger = new MessageTagger(taggerLLM, this.config);
    
    const summarizer = options.summarizer || new LLMSummarizer(options.agent);
    this.vectorSearch = options.vectorSearch as InMemoryVectorSearch || new InMemoryVectorSearch();

    this.compactor = new ThreadCompactor(this.threadManager, this.config, summarizer, this.vectorSearch);
    this.contextAssembler = new ContextAssembler(this.threadManager, this.vectorSearch);
  }
  
  /**
   * Process new messages and update topic threads
   */
  async processMessages(messages: ResponseInput): Promise<void> {
    // Add new messages to the queue
    const newMessages = messages.slice(this.lastProcessedIndex);
    this.messageQueue.push(...newMessages);
    this.lastProcessedIndex = messages.length;
    
    // Don't process if already processing
    if (this.isProcessing) {
      return;
    }
    
    // Determine if processing should run
    const threshold = this.config.processingThreshold;
    if (newMessages.length === 0 && this.messageQueue.length < threshold) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Get the sliding window of recent messages
      const windowSize = Math.min(this.config.slidingWindowSize, this.messageQueue.length);
      const recentMessages = this.messageQueue.slice(-windowSize);
      
      // Get existing topics
      const existingTopics = this.threadManager.getAllThreads().map(t => t.name);
      
      // Tag the messages
      const taggedMessages = await this.tagger.tagMessages(recentMessages, existingTopics);
      
      // Process each tagged message
      for (const taggedMsg of taggedMessages) {
        const originalMsg = recentMessages.find(m => m.id === taggedMsg.messageId);
        if (!originalMsg) continue;
        
        const message: Message = {
          id: originalMsg.id || `msg_${Date.now()}`,
          role: 'role' in originalMsg ? originalMsg.role as Message['role'] : 'user',
          content: 'content' in originalMsg && typeof originalMsg.content === 'string' 
            ? originalMsg.content 
            : 'content' in originalMsg ? JSON.stringify(originalMsg.content) : '',
          timestamp: Date.now()
        };
        
        // Add message to each topic thread
        for (const topicName of taggedMsg.topics) {
          // Skip ephemeral messages
          if (topicName === 'ephemeral') continue;
          
          // Create thread if it doesn't exist
          if (!this.threadManager.getThread(topicName)) {
            const initialState = topicName === 'core' ? 'core' : 'active';
            this.threadManager.createThread(topicName, initialState);
          }
          
          // Add message to thread
          this.threadManager.addMessageToThread(topicName, message);
        }
      }
      
      // Process topic relationships if using LLMTagger
      if (this.tagger instanceof MessageTagger && 
          (this.tagger as any).llm instanceof LLMTagger) {
        const llmTagger = (this.tagger as any).llm as LLMTagger;
        const relationships = llmTagger.getTopicRelationships();
        
        for (const rel of relationships) {
          // Ensure both topics exist
          if (this.threadManager.getThread(rel.parent) && 
              this.threadManager.getThread(rel.child)) {
            this.threadManager.addThreadRelationship(rel.child, rel.parent);
          }
        }
      }
      
      // Run compaction cycle if needed
      if (this.compactor.shouldRunCompaction()) {
        await this.compactor.runCompactionCycle();
      }
      
      // Clear processed messages from queue
      this.messageQueue = this.messageQueue.slice(-5); // Keep last 5 for context
      
    } catch (error) {
      console.error('[MetaMemory] Error processing messages:', error);
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Build context for the main LLM
   */
  async buildContext(
    recentMessages: ResponseInput,
    options?: Partial<ContextAssemblyOptions>
  ): Promise<ResponseInput> {
    const assemblyOptions: ContextAssemblyOptions = {
      maxTokens: 100000,
      includeIdleSummaries: true,
      includeArchivedSearch: true,
      recentMessageCount: 30,
      ...options
    };
    
    return this.contextAssembler.buildContext(recentMessages, assemblyOptions);
  }
  
  /**
   * Get the current state of metamemory
   */
  getState(): MetamemoryStateType {
    const threads = this.threadManager.exportThreads();
    
    // Convert to old format for backward compatibility
    const threadMap = new Map();
    for (const [name, thread] of Object.entries(threads)) {
      threadMap.set(name, {
        id: thread.name,
        name: thread.name,
        messages: thread.messages.map(m => m.id),
        status: thread.state === 'active' ? 'active' : 
                thread.state === 'idle' ? 'paused' : 'complete',
        summary: thread.summary,
        keyPoints: [],
        lastUpdated: thread.lastActiveTimestamp,
        class: thread.state === 'core' ? 'core' :
               thread.state === 'active' ? 'active' :
               thread.state === 'archived' ? 'complete' : 'ephemeral',
        createdAt: thread.createdAt
      });
    }
    
    return {
      metamemory: new Map(), // Empty for now
      threads: threadMap,
      lastProcessedIndex: this.lastProcessedIndex,
      lastProcessedTime: Date.now(),
      vectorEmbeddings: this.vectorSearch.exportEmbeddings()
    };
  }
  
  /**
   * Restore metamemory from a saved state
   */
  restoreState(state: MetamemoryStateType): void {
    // Convert old thread format to new format
    const threads: TopicThreadStore = {};
    
    // Iterate over the Map entries
    for (const [_, oldThread] of state.threads) {
      threads[oldThread.name] = {
        name: oldThread.name,
        state: oldThread.class === 'core' ? 'core' :
               oldThread.status === 'active' ? 'active' :
               oldThread.status === 'paused' ? 'idle' : 'archived',
        messages: [], // Messages would need to be reconstructed
        summary: oldThread.summary || '',
        lastActiveTimestamp: oldThread.lastUpdated,
        createdAt: oldThread.createdAt,
        tokenCount: 0,
        relationships: []
      };
    }
    
    this.threadManager.importThreads(threads);
    this.lastProcessedIndex = state.lastProcessedIndex;

    this.vectorSearch.clear();
    if (state.vectorEmbeddings) {
      this.vectorSearch.loadEmbeddings(state.vectorEmbeddings);
    } else {
      for (const thread of Object.values(threads)) {
        if (thread.state === 'archived') {
          void this.vectorSearch.addThread(thread);
        }
      }
    }
  }
  
  /**
   * Manually mark a topic as core
   */
  markTopicAsCore(topicName: string): void {
    const thread = this.threadManager.getThread(topicName);
    if (thread) {
      this.threadManager.updateThreadState(topicName, 'core');
    } else {
      this.threadManager.createThread(topicName, 'core');
    }
  }
  
  /**
   * Manually trigger compaction
   */
  async forceCompaction(): Promise<void> {
    await this.compactor.runCompactionCycle();
  }

  /**
   * Build a compacted history using current threads and vector search.
   * This runs a compaction cycle to update summaries before assembling context.
   */
  async compactHistory(
    recentMessages: ResponseInput,
    options?: Partial<ContextAssemblyOptions>
  ): Promise<ResponseInput> {
    await this.compactor.runCompactionCycle();

    const assemblyOptions: ContextAssemblyOptions = {
      maxTokens: 100000,
      includeIdleSummaries: true,
      includeArchivedSearch: true,
      recentMessageCount: 30,
      ...options
    };

    return this.contextAssembler.buildContext(recentMessages, assemblyOptions);
  }
  
  /**
   * Get memory statistics
   */
  getMemoryStats() {
    return this.contextAssembler.getMemoryStats();
  }
}

/**
 * Create a new metamemory state
 */
export function createMetamemoryState(): MetamemoryStateType {
  return {
    metamemory: new Map(),
    threads: new Map(),
    lastProcessedIndex: 0,
    lastProcessedTime: Date.now(),
    vectorEmbeddings: {}
  };
}