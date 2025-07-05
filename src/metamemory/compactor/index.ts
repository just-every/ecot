import { TopicThread, MetaMemoryConfig, CompactionLevel } from '../types/index.js';
import { TopicThreadManager } from '../utils/topic-thread-manager.js';
import { InMemoryVectorSearch } from '../utils/vector-search.js';

export interface SummarizerInterface {
  summarize(
    thread: TopicThread,
    messagesToSummarize: number,
    level: CompactionLevel
  ): Promise<string>;
}

export class ThreadCompactor {
  private threadManager: TopicThreadManager;
  private config: MetaMemoryConfig;
  private summarizer: SummarizerInterface;
  private lastCompactionTime: number = Date.now();
  private vectorSearch?: InMemoryVectorSearch;
  
  constructor(
    threadManager: TopicThreadManager,
    config: MetaMemoryConfig,
    summarizer: SummarizerInterface,
    vectorSearch?: InMemoryVectorSearch
  ) {
    this.threadManager = threadManager;
    this.config = config;
    this.summarizer = summarizer;
    this.vectorSearch = vectorSearch;
  }
  
  /**
   * Run compaction and state checks on all threads
   */
  async runCompactionCycle(): Promise<void> {
    const now = Date.now();
    const threads = this.threadManager.getAllThreads();
    
    for (const thread of threads) {
      // Skip core and archived threads
      if (thread.state === 'core' || thread.state === 'archived') {
        continue;
      }
      
      // Check state transitions
      await this.checkStateTransitions(thread);
      
      // Check if compaction is needed
      await this.checkAndCompact(thread);
    }
    
    this.lastCompactionTime = now;
  }
  
  /**
   * Check if a thread should transition to a different state
   */
  private async checkStateTransitions(thread: TopicThread): Promise<void> {
    // Active -> Idle transition
    if (thread.state === 'active') {
      const isInactive = this.threadManager.isThreadInactive(
        thread,
        this.config.inactivityThresholdMinutes.activeToIdle
      );
      
      if (isInactive) {
        console.log(`[MetaMemory] Transitioning thread "${thread.name}" from active to idle`);
        this.threadManager.updateThreadState(thread.name, 'idle');
        
        // Trigger heavy compaction
        await this.compactThread(thread, 'heavy');
      }
    }
    
    // Idle -> Archived transition
    if (thread.state === 'idle') {
      const isVeryInactive = this.threadManager.isThreadInactive(
        thread,
        this.config.inactivityThresholdMinutes.idleToArchived
      );
      
      if (isVeryInactive) {
        console.log(`[MetaMemory] Archiving thread "${thread.name}"`);
        this.threadManager.updateThreadState(thread.name, 'archived');
        
        // Trigger archival compaction
        await this.compactThread(thread, 'archival');
        
        // Add to vector search for later retrieval
        if (this.vectorSearch && thread.summary) {
          await this.vectorSearch.addThread(thread);
        }
      }
    }
  }
  
  /**
   * Check if a thread needs compaction based on token count
   */
  private async checkAndCompact(thread: TopicThread): Promise<void> {
    if (thread.state === 'active' && thread.tokenCount > this.config.maxTokensPerActiveThread) {
      console.log(`[MetaMemory] Active thread "${thread.name}" exceeds token limit, compacting`);
      await this.compactThread(thread, 'light');
    }
    
    if (thread.state === 'idle' && thread.tokenCount > this.config.maxTokensPerIdleThread) {
      console.log(`[MetaMemory] Idle thread "${thread.name}" exceeds token limit, compacting`);
      await this.compactThread(thread, 'heavy');
    }
  }
  
  /**
   * Compact a thread with the specified level
   */
  private async compactThread(
    thread: TopicThread,
    levelType: 'light' | 'heavy' | 'archival'
  ): Promise<void> {
    const level = this.getCompactionLevel(levelType);
    
    // Calculate how many messages to compact
    const totalMessages = thread.messages.length;
    const messagesToKeep = level.preserveLatestMessages;
    const messagesToCompact = Math.max(0, totalMessages - messagesToKeep);
    
    if (messagesToCompact === 0) {
      return; // Nothing to compact
    }
    
    // Get the summary from the summarizer
    const summary = await this.summarizer.summarize(thread, messagesToCompact, level);
    
    // Update the thread with the new summary
    const existingSummary = thread.summary || '';
    const newSummary = existingSummary ? `${existingSummary}\n\n${summary}` : summary;
    this.threadManager.updateThreadSummary(thread.name, newSummary);
    
    // Remove the compacted messages
    this.threadManager.compactThread(thread.name, messagesToKeep);
    
    console.log(
      `[MetaMemory] Compacted ${messagesToCompact} messages from thread "${thread.name}" (${levelType})`
    );
  }
  
  /**
   * Get compaction level configuration
   */
  private getCompactionLevel(level: 'light' | 'heavy' | 'archival'): CompactionLevel {
    switch (level) {
      case 'light':
        return {
          level: 'light',
          maxTokens: 1000,
          preserveLatestMessages: 50
        };
      case 'heavy':
        return {
          level: 'heavy',
          maxTokens: 500,
          preserveLatestMessages: 20
        };
      case 'archival':
        return {
          level: 'archival',
          maxTokens: 300,
          preserveLatestMessages: 0
        };
    }
  }
  
  /**
   * Manually trigger compaction on a specific thread
   */
  async compactThreadByName(
    threadName: string,
    level: 'light' | 'heavy' | 'archival'
  ): Promise<void> {
    const thread = this.threadManager.getThread(threadName);
    if (!thread) {
      throw new Error(`Thread "${threadName}" not found`);
    }
    
    await this.compactThread(thread, level);
  }
  
  /**
   * Check if enough time has passed for a compaction cycle
   */
  shouldRunCompaction(): boolean {
    const timeSinceLastCompaction = Date.now() - this.lastCompactionTime;
    return timeSinceLastCompaction >= this.config.compactionInterval;
  }
}