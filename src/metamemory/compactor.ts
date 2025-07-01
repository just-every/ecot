import type { ResponseInputItem } from '@just-every/ensemble';
import type {
  MetamemoryState,
  CompactionResult,
  CompactedMessage,
  CompactionOptions,
  Thread,
  MetamemoryOptions,
} from './types.js';

export class HistoryCompactor {
  private options: Required<MetamemoryOptions>;
  
  constructor(options: MetamemoryOptions = {}) {
    this.options = {
      windowSize: 20,
      processInterval: 5,
      threadInactivityTimeout: 300000,
      maxThreadsToTrack: 50,
      compactionThresholds: {
        core: 100,
        active: 80,
        complete: 60,
        ephemeral: 20,
      },
      ...options
    } as Required<MetamemoryOptions>;
  }

  async compactHistory(
    messages: ResponseInputItem[],
    state: MetamemoryState,
    options: CompactionOptions = {}
  ): Promise<CompactionResult> {
    const processedMessageIds = new Set<string>();
    const compactedMessages: CompactedMessage[] = [];
    const metadata = {
      originalCount: messages.length,
      compactedCount: 0,
      threadsPreserved: [] as string[],
      threadsSummarized: [] as string[],
      originalTokens: 0,
      compactedTokens: 0
    };

    // Build a map of message ID to message for quick lookup
    const messageMap = new Map<string, ResponseInputItem>();
    for (const msg of messages) {
      if (msg.id) {
        messageMap.set(msg.id, msg);
      }
    }

    // Process threads by priority
    const threadPriorities = this.calculateThreadPriorities(state, options);
    const sortedThreads = this.sortThreadsByPriority(
      Array.from(state.threads.entries()),
      threadPriorities
    );

    // Process each thread
    for (const [threadId, thread] of sortedThreads) {
      // Get messages for this thread that haven't been processed yet
      const threadMessageIds = thread.messages.filter(id => !processedMessageIds.has(id));
      const threadMessages = threadMessageIds
        .map(id => messageMap.get(id))
        .filter(Boolean) as ResponseInputItem[];
      
      if (threadMessages.length === 0) continue;

      const compactionThreshold = this.options.compactionThresholds[thread.class] || 50;
      
      // Decide how to handle this thread based on class and status
      const shouldPreserve = 
        thread.class === 'core' || 
        (thread.class === 'active' && thread.status === 'active') ||
        options.preserveThreadIds?.includes(threadId);
        
      const shouldSummarize = 
        thread.class === 'ephemeral' ||
        (thread.class === 'complete') ||
        (thread.class === 'active' && thread.status === 'complete');

      if (shouldPreserve && !shouldSummarize) {
        // Preserve thread with class-specific rules
        const preserved = this.applyClassRules(
          thread,
          threadMessages,
          threadId,
          options
        );
        compactedMessages.push(...preserved);
        metadata.threadsPreserved.push(threadId);
      } else if (shouldSummarize || threadPriorities.get(threadId)! < compactionThreshold) {
        // Summarize thread
        const summary = this.createThreadSummary(thread, threadMessages, threadId);
        if (summary) {
          compactedMessages.push(summary);
          metadata.threadsSummarized.push(threadId);
        }
      } else {
        // Apply class rules (for active threads with mixed handling)
        const preserved = this.applyClassRules(
          thread,
          threadMessages,
          threadId,
          options
        );
        compactedMessages.push(...preserved);
        metadata.threadsPreserved.push(threadId);
      }

      // Mark these messages as processed
      threadMessageIds.forEach(id => processedMessageIds.add(id));
    }

    // Add orphaned messages (not in any thread or not processed yet)
    const orphanedMessages = messages.filter(m => {
      if (!m.id) return true;
      if (processedMessageIds.has(m.id)) return false;
      const entry = state.metamemory.get(m.id);
      return !entry || entry.threadIds.length === 0;
    });

    if (orphanedMessages.length > 0) {
      // If most messages are orphaned, metamemory probably hasn't processed yet
      // Return original messages instead of truncating
      const orphanedRatio = orphanedMessages.length / messages.length;
      
      if (orphanedRatio > 0.5) {
        // More than 50% unprocessed - just return original messages
        console.log('[Metamemory] Compaction skipped: metamemory processing incomplete');
        return {
          messages: messages.map(m => ({
            role: m.type === 'message' ? m.role : 'system',
            content: m.type === 'message' ? 
              (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)) : 
              `[${m.type}]`,
            timestamp: m.timestamp,
            threadIds: [],
            isCompacted: false
          })),
          metadata: {
            ...metadata,
            compactedCount: messages.length,
            compactedTokens: metadata.originalTokens
          }
        };
      } else {
        // Only a few orphaned messages - preserve them individually
        orphanedMessages.forEach(msg => {
          if (msg.type === 'message') {
            compactedMessages.push({
              role: msg.role,
              content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
              timestamp: msg.timestamp,
              threadIds: [],
              isCompacted: false
            });
          }
        });
        
        // Mark these as processed
        orphanedMessages.forEach(msg => {
          if (msg.id) processedMessageIds.add(msg.id);
        });
      }
    }

    // Sort messages chronologically
    compactedMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    metadata.compactedCount = compactedMessages.length;
    
    // Calculate token counts (approximate: 4 chars = 1 token)
    metadata.originalTokens = messages.reduce((total, msg) => {
      if (msg.type === 'message' && msg.content) {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        return total + Math.ceil(content.length / 4);
      }
      return total;
    }, 0);
    
    metadata.compactedTokens = compactedMessages.reduce((total, msg) => {
      return total + Math.ceil(msg.content.length / 4);
    }, 0);

    return { messages: compactedMessages, metadata };
  }


  private calculateThreadPriorities(
    state: MetamemoryState,
    options: CompactionOptions
  ): Map<string, number> {
    const priorities = new Map<string, number>();
    
    for (const [threadId, thread] of state.threads) {
      let priority = 50; // Base priority
      
      // Class-based priority
      switch (thread.class) {
        case 'core': priority = 100; break;
        case 'active': priority = 80; break;
        case 'complete': priority = 60; break;
        case 'ephemeral': priority = 20; break;
      }
      
      // Recency boost
      const hoursSinceUpdate = (Date.now() - thread.lastUpdated) / (1000 * 60 * 60);
      if (hoursSinceUpdate < 1) priority += 20;
      else if (hoursSinceUpdate < 24) priority += 10;
      
      // Size penalty (very large threads get lower priority)
      if (thread.messages.length > 50) priority -= 10;
      
      // Preserved thread boost
      if (options.preserveThreadIds?.includes(threadId)) {
        priority = 100;
      }
      
      priorities.set(threadId, Math.max(0, Math.min(100, priority)));
    }
    
    return priorities;
  }

  private sortThreadsByPriority(
    threads: Array<[string, Thread]>,
    priorities: Map<string, number>
  ): Array<[string, Thread]> {
    return threads.sort((a, b) => {
      const priorityA = priorities.get(a[0]) || 0;
      const priorityB = priorities.get(b[0]) || 0;
      return priorityB - priorityA;
    });
  }

  private applyClassRules(
    thread: Thread,
    messages: ResponseInputItem[],
    threadId: string,
    options: CompactionOptions
  ): CompactedMessage[] {
    switch (thread.class) {
      case 'core':
        return this.preserveMessages(messages, threadId);
      case 'active':
        return this.compactActiveThread(thread, messages, threadId, options);
      case 'complete':
        return this.compactCompleteThread(thread, messages, threadId);
      case 'ephemeral':
        return this.compactEphemeralThread(thread, messages, threadId);
      default:
        return this.preserveMessages(messages, threadId);
    }
  }

  private compactActiveThread(
    _thread: Thread,
    messages: ResponseInputItem[],
    threadId: string,
    options: CompactionOptions
  ): CompactedMessage[] {
    const result: CompactedMessage[] = [];
    
    // Keep first few messages for context
    const contextMessages = messages.slice(0, 3);
    result.push(...this.preserveMessages(contextMessages, threadId));
    
    // Summarize middle section if too long
    const middleMessages = messages.slice(3, -5);
    if (middleMessages.length > 10 && !options.aggressiveMode) {
      const summary = this.createSectionSummary(
        middleMessages,
        threadId,
        'Middle section of active thread'
      );
      if (summary) result.push(summary);
    } else {
      result.push(...this.preserveMessages(middleMessages, threadId));
    }
    
    // Keep recent messages
    const recentMessages = messages.slice(-5);
    result.push(...this.preserveMessages(recentMessages, threadId));
    
    return result;
  }

  private compactCompleteThread(
    thread: Thread,
    messages: ResponseInputItem[],
    threadId: string
  ): CompactedMessage[] {
    // For complete threads, create a detailed summary
    return [this.createThreadSummary(thread, messages, threadId)!];
  }

  private compactEphemeralThread(
    _thread: Thread,
    messages: ResponseInputItem[],
    threadId: string
  ): CompactedMessage[] {
    // For ephemeral threads, create a brief summary
    const summary: CompactedMessage = {
      role: 'system',
      content: `[Ephemeral conversation: ${_thread.name || 'Chat'}]`,
      timestamp: messages[0]?.timestamp,
      threadIds: [threadId],
      isCompacted: true,
      originalMessageIds: messages.map(m => m.id).filter(Boolean) as string[]
    };
    
    return [summary];
  }

  private preserveMessages(
    messages: ResponseInputItem[],
    threadId: string
  ): CompactedMessage[] {
    return messages.map(m => {
      if (m.type === 'message') {
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return {
          role: m.role,
          content: content,
          timestamp: m.timestamp,
          threadIds: [threadId],
          isCompacted: false
        };
      }
      // For non-message types, create a placeholder
      return {
        role: 'system' as const,
        content: `[${m.type}]`,
        timestamp: m.timestamp,
        threadIds: [threadId],
        isCompacted: false
      };
    });
  }

  private createThreadSummary(
    thread: Thread,
    messages: ResponseInputItem[],
    threadId: string
  ): CompactedMessage | null {
    if (!thread.summary && messages.length === 0) return null;
    
    // If we have a summary, use it. Otherwise, create a basic one
    let content = '';
    if (thread.summary) {
      content = thread.summary;
      if (thread.keyPoints && thread.keyPoints.length > 0) {
        content += '\nKey points: ' + thread.keyPoints.join('; ');
      }
    } else {
      // Fallback: create a basic summary from messages
      const msgCount = messages.filter(m => m.type === 'message').length;
      content = `[${thread.name}: ${msgCount} messages about ${thread.name.toLowerCase()}]`;
    }
    
    return {
      role: 'system',
      content: content,
      timestamp: messages[0]?.timestamp,
      threadIds: [threadId],
      isCompacted: true,
      originalMessageIds: messages.map(m => m.id).filter(Boolean) as string[]
    };
  }

  private createSectionSummary(
    messages: ResponseInputItem[],
    threadId: string,
    description: string
  ): CompactedMessage | null {
    if (messages.length === 0) return null;
    
    const userMessages = messages.filter(m => m.type === 'message' && m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.type === 'message' && m.role === 'assistant').length;
    
    return {
      role: 'system',
      content: `[${description}: ${userMessages} user messages, ${assistantMessages} assistant responses]`,
      timestamp: messages[0]?.timestamp,
      threadIds: [threadId],
      isCompacted: true,
      originalMessageIds: messages.map(m => m.id).filter(Boolean) as string[]
    };
  }


}