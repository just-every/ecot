import { 
  TopicThread, 
  ContextAssemblyOptions, 
  VectorSearchResult 
} from '../types/index.js';
import { TopicThreadManager } from '../utils/topic-thread-manager.js';
import type { ResponseInput, ResponseInputItem } from '@just-every/ensemble';

export interface VectorSearchInterface {
  search(query: string, topK: number): Promise<VectorSearchResult[]>;
}

export { type VectorSearchResult };

export class ContextAssembler {
  private threadManager: TopicThreadManager;
  private vectorSearch?: VectorSearchInterface;
  
  constructor(threadManager: TopicThreadManager, vectorSearch?: VectorSearchInterface) {
    this.threadManager = threadManager;
    this.vectorSearch = vectorSearch;
  }
  
  /**
   * Build the context for the main LLM
   */
  async buildContext(
    recentMessages: ResponseInput,
    options: ContextAssemblyOptions
  ): Promise<ResponseInput> {
    const contextMessages: ResponseInputItem[] = [];
    
    // 1. Always include Core messages
    const coreMessages = this.getCoreMessages();
    if (coreMessages.length > 0) {
      contextMessages.push({
        type: 'message',
        role: 'system',
        content: '=== CORE INSTRUCTIONS ===\n' + coreMessages.join('\n')
      } as ResponseInputItem);
    }
    
    // 2. Include Active threads with summaries and recent messages
    const activeThreads = this.threadManager.getThreadsByState('active');
    for (const thread of activeThreads) {
      const threadContext = this.buildActiveThreadContext(thread, options.recentMessageCount);
      contextMessages.push(...threadContext);
    }
    
    // 3. Include Idle thread summaries if requested
    if (options.includeIdleSummaries) {
      const idleThreads = this.threadManager.getThreadsByState('idle');
      if (idleThreads.length > 0) {
        const idleSummaries = this.buildIdleSummaries(idleThreads);
        contextMessages.push({
          type: 'message',
          role: 'system',
          content: idleSummaries
        } as ResponseInputItem);
      }
    }
    
    // 4. Include relevant archived threads via vector search
    if (options.includeArchivedSearch && this.vectorSearch) {
      const relevantArchived = await this.searchRelevantArchived(recentMessages);
      if (relevantArchived.length > 0) {
        contextMessages.push({
          type: 'message',
          role: 'system',
          content: this.buildArchivedContext(relevantArchived)
        } as ResponseInputItem);
      }
    }
    
    // 5. Add the most recent conversation messages
    const recentCount = Math.min(options.recentMessageCount, recentMessages.length);
    const mostRecent = recentMessages.slice(-recentCount);
    
    contextMessages.push({
      type: 'message',
      role: 'system',
      content: '=== RECENT CONVERSATION ==='
    } as ResponseInputItem);
    contextMessages.push(...mostRecent);
    
    // Check token budget and trim if necessary
    return this.trimToTokenBudget(contextMessages, options.maxTokens);
  }
  
  /**
   * Get all core messages
   */
  private getCoreMessages(): string[] {
    const coreThreads = this.threadManager.getThreadsByState('core');
    const messages: string[] = [];
    
    for (const thread of coreThreads) {
      for (const msg of thread.messages) {
        messages.push(msg.content);
      }
    }
    
    return messages;
  }
  
  /**
   * Build context for an active thread
   */
  private buildActiveThreadContext(
    thread: TopicThread, 
    recentMessageCount: number
  ): ResponseInputItem[] {
    const items: ResponseInputItem[] = [];
    
    // Add thread header
    items.push({
      type: 'message',
      role: 'system',
      content: `=== ACTIVE TOPIC: ${thread.name} ===`
    } as ResponseInputItem);
    
    // Add summary if exists
    if (thread.summary) {
      items.push({
        type: 'message',
        role: 'system',
        content: `Summary of earlier discussion:\n${thread.summary}`
      } as ResponseInputItem);
    }
    
    // Add recent messages from the thread
    const recentMessages = this.threadManager.getRecentMessages(thread, recentMessageCount);
    for (const msg of recentMessages) {
      items.push({
        type: 'message',
        role: msg.role as any,
        content: msg.content,
        id: msg.id
      } as ResponseInputItem);
    }
    
    // Add thread footer
    items.push({
      type: 'message',
      role: 'system',
      content: `=== END TOPIC: ${thread.name} ===`
    } as ResponseInputItem);
    
    return items;
  }
  
  /**
   * Build summaries for idle threads
   */
  private buildIdleSummaries(idleThreads: TopicThread[]): string {
    let summaries = '=== IDLE TOPIC SUMMARIES ===\n\n';
    
    for (const thread of idleThreads) {
      if (thread.summary) {
        summaries += `Topic: ${thread.name}\n`;
        summaries += `Last Active: ${new Date(thread.lastActiveTimestamp).toISOString()}\n`;
        summaries += `Summary: ${thread.summary}\n\n`;
      }
    }
    
    return summaries;
  }
  
  /**
   * Search for relevant archived threads based on recent messages
   */
  private async searchRelevantArchived(
    recentMessages: ResponseInput
  ): Promise<VectorSearchResult[]> {
    if (!this.vectorSearch) {
      return [];
    }
    
    // Create query from recent messages
    const query = recentMessages
      .slice(-5)
      .map(msg => {
        if ('content' in msg && typeof msg.content === 'string') {
          return msg.content;
        }
        return '';
      })
      .filter(content => content !== '')
      .join(' ');
    
    // Search for relevant archived threads
    const results = await this.vectorSearch.search(query, 3);
    
    return results;
  }
  
  /**
   * Build context from archived search results
   */
  private buildArchivedContext(results: VectorSearchResult[]): string {
    let context = '=== RELEVANT ARCHIVED TOPICS ===\n\n';
    
    for (const result of results) {
      context += `Topic: ${result.topicName} (relevance: ${result.relevanceScore.toFixed(2)})\n`;
      context += `Summary: ${result.summary}\n\n`;
    }
    
    return context;
  }
  
  /**
   * Trim messages to fit within token budget
   */
  private trimToTokenBudget(
    messages: ResponseInputItem[],
    maxTokens: number
  ): ResponseInput {
    // Simple implementation - in production, use proper tokenization
    let totalTokens = 0;
    const result: ResponseInputItem[] = [];
    
    // Always keep core messages and recent messages
    // Start from the end and work backwards
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      let contentLength = 0;
      if ('content' in msg && typeof msg.content === 'string') {
        contentLength = msg.content.length;
      }
      const estimatedTokens = Math.ceil(contentLength / 4);
      
      if (totalTokens + estimatedTokens <= maxTokens) {
        result.unshift(msg);
        totalTokens += estimatedTokens;
      } else if ('role' in msg && msg.role === 'system' && 
                 'content' in msg && typeof msg.content === 'string' && 
                 msg.content.includes('CORE')) {
        // Always include core instructions
        result.unshift(msg);
        totalTokens += estimatedTokens;
      }
    }
    
    return result;
  }
  
  /**
   * Get a summary of the current memory state
   */
  getMemoryStats(): {
    coreThreads: number;
    activeThreads: number;
    idleThreads: number;
    archivedThreads: number;
    totalMessages: number;
    totalTokens: number;
  } {
    const threads = this.threadManager.getAllThreads();
    
    const stats = {
      coreThreads: 0,
      activeThreads: 0,
      idleThreads: 0,
      archivedThreads: 0,
      totalMessages: 0,
      totalTokens: 0
    };
    
    for (const thread of threads) {
      switch (thread.state) {
        case 'core':
          stats.coreThreads++;
          break;
        case 'active':
          stats.activeThreads++;
          break;
        case 'idle':
          stats.idleThreads++;
          break;
        case 'archived':
          stats.archivedThreads++;
          break;
      }
      
      stats.totalMessages += thread.messages.length;
      stats.totalTokens += thread.tokenCount;
    }
    
    return stats;
  }
}