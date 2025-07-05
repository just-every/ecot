import { ResponseInputItem, Agent, ensembleRequest, type ResponseInput } from '@just-every/ensemble';
import type {
  MetamemoryState,
  Thread,
  ThreadSummaryResult,
  ThreadClass,
  MetamemoryOptions,
} from './types.js';

export class ThreadSummarizer {
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

  async summarizeThreads(
    state: MetamemoryState,
    messages: ResponseInputItem[],
    _agent: Agent,
    threadIds?: string[]
  ): Promise<Map<string, Thread>> {
    const threadsToSummarize = this.getThreadsToSummarize(state, threadIds);
    const updatedThreads = new Map(state.threads);

    for (const thread of threadsToSummarize) {
      const threadMessages = this.getThreadMessages(thread, messages, state);
      if (threadMessages.length === 0) continue;

      const summary = await this.generateThreadSummary(
        thread,
        threadMessages
      );

      const updatedThread: Thread = {
        ...thread,
        summary: summary.keySummary,
        keyPoints: summary.keyPoints,
        class: summary.class,
        status: summary.status,
        lastUpdated: Date.now()
      };

      updatedThreads.set(thread.id, updatedThread);
    }

    return updatedThreads;
  }

  private getThreadsToSummarize(
    state: MetamemoryState,
    threadIds?: string[]
  ): Thread[] {
    const threads: Thread[] = [];
    
    for (const [id, thread] of state.threads) {
      if (threadIds && !threadIds.includes(id)) continue;
      
      const shouldSummarize = 
        thread.messages.length >= 5 ||
        thread.status === 'complete' ||
        (Date.now() - thread.lastUpdated > this.options.threadInactivityTimeout && 
         thread.messages.length > 0);
      
      if (shouldSummarize) {
        threads.push(thread);
      }
    }
    
    return threads;
  }

  private getThreadMessages(
    thread: Thread,
    allMessages: ResponseInputItem[],
    state: MetamemoryState
  ): ResponseInputItem[] {
    const threadMessages: ResponseInputItem[] = [];
    const messageMap = new Map(allMessages.filter(m => m.id).map(m => [m.id, m]));
    
    for (const messageId of thread.messages) {
      const message = messageMap.get(messageId);
      if (message) {
        threadMessages.push(message);
      }
    }
    
    return threadMessages.sort((a, b) => {
      const aTime = state.metamemory.get(a.id || '')?.timestamp || 0;
      const bTime = state.metamemory.get(b.id || '')?.timestamp || 0;
      return aTime - bTime;
    });
  }

  private async generateThreadSummary(
    thread: Thread,
    messages: ResponseInputItem[]
  ): Promise<ThreadSummaryResult> {
    const summaryPrompt = this.buildSummaryPrompt(thread, messages);

    // Use JSON schema for consistent output
    const metaAgent = new Agent({
      name: 'ThreadSummarizer',
      modelClass: 'summary', // Use summary class for summarization tasks
      instructions: summaryPrompt,
      modelSettings: {
        json_schema: {
          name: 'thread_summary',
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              threadId: { type: 'string' },
              title: { type: 'string' },
              class: { 
                type: 'string',
                enum: ['core', 'active', 'complete', 'ephemeral']
              },
              keySummary: { type: 'string' },
              keyPoints: {
                type: 'array',
                items: { type: 'string' },
                maxItems: 10
              },
              status: {
                type: 'string',
                enum: ['active', 'complete', 'paused']
              },
              importance: {
                type: 'number',
                minimum: 0,
                maximum: 100
              }
            },
            required: ['threadId', 'title', 'class', 'keySummary', 'keyPoints', 'status', 'importance'],
            additionalProperties: false
          }
        }
      }
    });

    const messages_prompt: ResponseInput = [{
      type: 'message',
      role: 'user',
      content: 'Analyze the thread and provide a summary.'
    }];

    let result: ThreadSummaryResult | null = null;

    for await (const event of ensembleRequest(messages_prompt, metaAgent)) {
      if (event.type === 'response_output') {
        const outputEvent = event as any;
        if (outputEvent.message) {
          try {
            // Parse the JSON response
            const content = outputEvent.message.content;
            result = typeof content === 'string' ? JSON.parse(content) : content;
            console.log('[Metamemory] result:', result);
          } catch (e) {
            console.error('[Metamemory] Failed to parse JSON response:', e);
            console.error('[Metamemory] Raw content:', outputEvent.message.content);
            throw new Error('Failed to parse LLM JSON response');
          }
        }
      }
    }

    if (!result) {
      throw new Error('Failed to get summary from LLM');
    }

    return result;
  }

  private buildSummaryPrompt(thread: Thread, messages: ResponseInputItem[]): string {
    const messageContent = messages.map(m => {
      if (m.type === 'message') {
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return {
          role: m.role,
          content: content.length > 1000 
            ? content.substring(0, 1000) + '...' 
            : content
        };
      }
      return null;
    }).filter(Boolean);

    return `Summarize the following conversation thread into a concise summary.

Thread Information:
- ID: ${thread.id}
- Name: ${thread.name}
- Current Status: ${thread.status}
- Message Count: ${messages.length}
- Current Class: ${thread.class}

Messages:
${JSON.stringify(messageContent, null, 2)}

Instructions:
1. Create a 2-3 sentence summary capturing the essence of this thread
2. Extract 3-5 key points or decisions made
3. Classify the thread:
   - "core": System messages, constraints, fundamental setup
   - "active": Currently being worked on
   - "complete": Task finished
   - "ephemeral": Social chat, temporary discussion
4. Determine if the thread is active, complete, or paused
5. Rate importance 0-100 (100 = critical, 0 = can be discarded)

Focus on capturing actionable information and key outcomes.`;
  }

  determineThreadClass(thread: Thread, messages: ResponseInputItem[]): ThreadClass {
    // Check for system/developer messages
    const hasSystemMessages = messages.some(m => 
      m.type === 'message' && (m.role === 'system' || m.role === 'developer')
    );
    if (hasSystemMessages) return 'core';

    // Check if thread is complete
    if (thread.status === 'complete') return 'complete';

    // Check for ephemeral content with better heuristics
    const ephemeralPatterns = [
      /^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening))[\s!.,]*$/i,
      /^(thanks|thank\s+you|ty|thx)[\s!.,]*$/i,
      /^(bye|goodbye|see\s+you|later|ttyl)[\s!.,]*$/i,
      /^(how\s+are\s+you|how's\s+it\s+going|what's\s+up)[\s!?.,]*$/i,
      /^(yes|no|ok|okay|sure|got\s+it|understood|makes\s+sense)[\s!.,]*$/i,
      /^(great|nice|awesome|cool|perfect|excellent)[\s!.,]*$/i
    ];
    
    let ephemeralCount = 0;
    let totalMessageLength = 0;
    
    for (const message of messages) {
      if (message.type === 'message' && message.content) {
        const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
        totalMessageLength += content.length;
        
        // Check if message matches ephemeral patterns
        const trimmedContent = content.trim();
        if (ephemeralPatterns.some(pattern => pattern.test(trimmedContent))) {
          ephemeralCount++;
        }
      }
    }
    
    // Calculate ephemeral ratio
    const ephemeralRatio = messages.length > 0 ? ephemeralCount / messages.length : 0;
    const avgMessageLength = messages.length > 0 ? totalMessageLength / messages.length : 0;
    
    // Thread is ephemeral if:
    // - Most messages match ephemeral patterns
    // - OR thread is short with low average message length
    // - OR thread name suggests social chat
    const isEphemeral = 
      ephemeralRatio > 0.6 || 
      (messages.length < 5 && avgMessageLength < 50) ||
      (thread.name && /chat|social|greeting|small\s*talk/i.test(thread.name));
    
    if (isEphemeral) return 'ephemeral';

    // Default to active
    return 'active';
  }
}