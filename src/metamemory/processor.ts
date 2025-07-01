import { ResponseInputItem, Agent, ensembleRequest, type ResponseInput } from '@just-every/ensemble';
import type {
  MetamemoryState,
  MessageAnalysisResult,
  ProcessingTrigger,
  MetamemoryOptions,
  Thread,
  MetamemoryEntry,
} from './types.js';

const DEFAULT_OPTIONS: MetamemoryOptions = {
  windowSize: 20,
  processInterval: 5,
  threadInactivityTimeout: 300000, // 5 minutes
  maxThreadsToTrack: 50,
  compactionThresholds: {
    core: 100,
    active: 80,
    complete: 60,
    ephemeral: 20,
  },
};

export class MessageProcessor {
  private options: Required<MetamemoryOptions>;
  
  constructor(options: MetamemoryOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options } as Required<MetamemoryOptions>;
  }

  async processMessages(
    messages: ResponseInputItem[],
    state: MetamemoryState,
    _agent: Agent,
    trigger?: ProcessingTrigger
  ): Promise<MetamemoryState> {
    const shouldProcess = this.shouldProcess(messages, state, trigger);
    if (!shouldProcess) {
      return state;
    }

    const startIndex = Math.max(0, messages.length - this.options.windowSize);
    const windowMessages = messages.slice(startIndex);
    
    try {
      const analysisResult = await this.analyzeMessages(
        windowMessages,
        state,
        messages
      );

      const updatedState = this.applyAnalysisResults(
        analysisResult,
        state,
        windowMessages
      );

      updatedState.lastProcessedIndex = messages.length;
      updatedState.lastProcessedTime = Date.now();
      
      console.log('\n[Metamemory] === Processing Complete ===');
      console.log(`[Metamemory] Processed ${windowMessages.length} messages`);
      console.log(`[Metamemory] Total threads: ${updatedState.threads.size}`);
      console.log(`[Metamemory] Messages tracked: ${updatedState.metamemory.size}`);

      return updatedState;
    } catch (error) {
      console.error('[Metamemory] Error processing messages:', error);
      // Return state unchanged on error
      return state;
    }
  }

  private shouldProcess(
    messages: ResponseInputItem[],
    state: MetamemoryState,
    trigger?: ProcessingTrigger
  ): boolean {
    if (trigger?.type === 'manual') return true;
    
    const messagesSinceLastProcess = messages.length - state.lastProcessedIndex;
    const timeSinceLastProcess = Date.now() - state.lastProcessedTime;
    
    if (trigger?.type === 'interval' && messagesSinceLastProcess >= this.options.processInterval) {
      return true;
    }
    
    if (trigger?.type === 'large_message') {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.type === 'message') {
        const content = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);
        if (content.length > (trigger.threshold || 2000)) {
          return true;
        }
      }
    }
    
    if (trigger?.type === 'time_gap' && timeSinceLastProcess > (trigger.threshold || 60000)) {
      return true;
    }
    
    return messagesSinceLastProcess >= this.options.processInterval;
  }

  private async analyzeMessages(
    windowMessages: ResponseInputItem[],
    state: MetamemoryState,
    allMessages: ResponseInputItem[]
  ): Promise<MessageAnalysisResult> {
    const activeThreads = this.getActiveThreads(state, allMessages);
    const previousAssignments = this.getPreviousAssignments(windowMessages, state);
    
    const analysisPrompt = this.buildAnalysisPrompt(
      windowMessages,
      activeThreads,
      previousAssignments
    );

    // Use JSON schema for consistent output
    const metaAgent = new Agent({
      name: 'MetamemoryAnalyzer',
      modelClass: 'summary', // Use summary class for analysis tasks
      instructions: analysisPrompt,
      modelSettings: {
        json_schema: {
          name: 'message_analysis',
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              messageAnalysis: {
                type: 'array',
                description: 'Analysis results for each message',
                items: {
                  type: 'object',
                  properties: {
                    messageId: { type: 'string' },
                    threadIds: { 
                      type: 'array', 
                      items: { type: 'string' },
                      description: 'Array of existing thread IDs from the Active Threads list'
                    },
                    confidence: { 
                      type: 'number',
                      description: 'Confidence score between 0.0 and 1.0'
                    }
                  },
                  required: ['messageId', 'threadIds', 'confidence'],
                  additionalProperties: false
                }
              },
              threadOperations: {
                type: 'object',
                properties: {
                  create: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        initialMessages: { 
                          type: 'array', 
                          items: { type: 'string' } 
                        }
                      },
                      required: ['id', 'name', 'initialMessages'],
                      additionalProperties: false
                    }
                  },
                  merge: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        sourceThreads: { 
                          type: 'array', 
                          items: { type: 'string' } 
                        },
                        targetThread: { type: 'string' }
                      },
                      required: ['sourceThreads', 'targetThread'],
                      additionalProperties: false
                    }
                  },
                  close: { 
                    type: 'array', 
                    items: { type: 'string' }
                  }
                },
                additionalProperties: false
              },
              reasoning: { type: 'string' }
            },
            required: ['messageAnalysis', 'threadOperations', 'reasoning'],
            additionalProperties: false
          }
        }
      }
    });

    const messages: ResponseInput = [{
      type: 'message',
      role: 'user',
      content: 'Analyze the messages and provide thread assignments.'
    }];

    let result: MessageAnalysisResult | null = null;
    console.log('\n[Metamemory] === LLM Analysis Request ===');
    console.log('[Metamemory] Window messages:', windowMessages.length);
    console.log('[Metamemory] Active threads:', activeThreads.map(t => `${t.id} (${t.name})`));

    for await (const event of ensembleRequest(messages, metaAgent)) {
      if (event.type === 'response_output') {
        const outputEvent = event as any;
        if (outputEvent.message) {
          try {
            // Parse the JSON response
            const content = outputEvent.message.content;
            result = typeof content === 'string' ? JSON.parse(content) : content;
            
            console.log('\n[Metamemory] === LLM Response ===');
            console.log('[Metamemory] Raw response:', result);
            
            console.log('\n[Metamemory] === Parsed Result ===');
            console.log('[Metamemory] Message analyses:', result?.messageAnalysis?.length || 0);
            if (result?.messageAnalysis) {
              result.messageAnalysis.forEach((analysis, i) => {
                console.log(`[Metamemory]   ${i+1}. Message ${analysis.messageId}:`);
                console.log(`[Metamemory]      - Threads: [${analysis.threadIds.join(', ')}]`);
                console.log(`[Metamemory]      - Confidence: ${analysis.confidence}`);
              });
            }
            if (result?.threadOperations) {
              console.log('[Metamemory] Thread operations:', JSON.stringify(result.threadOperations, null, 2));
            }
          } catch (e) {
            console.error('[Metamemory] Failed to parse JSON response:', e);
            console.error('[Metamemory] Raw content:', outputEvent.message.content);
            throw new Error('Failed to parse LLM JSON response');
          }
        }
      }
    }

    if (!result) {
      throw new Error('Failed to get analysis from LLM');
    }

    return result;
  }

  private getActiveThreads(state: MetamemoryState, _messages: ResponseInputItem[]): Thread[] {
    const activeThreads: Thread[] = [];
    const cutoffTime = Date.now() - this.options.threadInactivityTimeout;
    
    for (const [_threadId, thread] of state.threads) {
      if (thread.lastUpdated > cutoffTime || thread.status === 'active') {
        activeThreads.push(thread);
      }
    }
    
    return activeThreads.slice(0, this.options.maxThreadsToTrack);
  }

  private getPreviousAssignments(
    messages: ResponseInputItem[],
    state: MetamemoryState
  ): Map<string, string[]> {
    const assignments = new Map<string, string[]>();
    
    for (const message of messages) {
      if (message.id) {
        const entry = state.metamemory.get(message.id);
        if (entry) {
          assignments.set(message.id, entry.threadIds);
        }
      }
    }
    
    return assignments;
  }

  private buildAnalysisPrompt(
    messages: ResponseInputItem[],
    activeThreads: Thread[],
    previousAssignments: Map<string, string[]>
  ): string {
    const messageList = messages.map((m, idx) => {
      if (m.type === 'message') {
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return {
          id: m.id,
          role: m.role,
          content: content.substring(0, 500),
          previousThreads: previousAssignments.get(m.id || '') || [],
          index: idx // Add index to help identify Q&A pairs
        };
      }
      return null;
    }).filter(Boolean);

    const threadList = activeThreads.map(t => ({
      id: t.id,
      name: t.name,
      summary: t.summary,
      messageCount: t.messages.length,
      lastMessage: t.messages[t.messages.length - 1] || null
    }));

    return `Analyze the following conversation messages and assign them to appropriate threads.

Active Threads:
${JSON.stringify(threadList, null, 2)}

Messages to Analyze:
${JSON.stringify(messageList, null, 2)}

CRITICAL INSTRUCTIONS:
1. ALWAYS group user questions with their assistant answers in the SAME thread
2. Look for Q&A patterns: if message[i] is a user question and message[i+1] is an assistant answer, they MUST be in the same thread
3. Use EXACT thread IDs from Active Threads list (the "id" field, not "name")
4. Create new threads with descriptive IDs like "thread_topic_name"
5. Mark threads as complete when:
   - The user says "thanks", "great", "done", "finished"
   - The assistant completes a task or provides a final answer
   - No follow-up questions for 3+ messages
6. NEVER split a question from its answer

THREAD PATTERNS:
- User asks about X -> Assistant explains X -> Both in "thread_x_discussion"
- User requests task Y -> Assistant performs Y -> Both in "thread_y_task"
- Social chat (hello, thanks, bye) -> "thread_ephemeral_chat"

EXAMPLE Q&A GROUPING:
Message 1: {role: "user", content: "What is recursion?"} 
Message 2: {role: "assistant", content: "Recursion is..."}
CORRECT: Both get threadIds: ["thread_recursion"]
WRONG: Different threadIds for each

For existing threads, check if the last message expects a response.`;
  }

  private applyAnalysisResults(
    result: MessageAnalysisResult,
    state: MetamemoryState,
    windowMessages: ResponseInputItem[]
  ): MetamemoryState {
    const newState: MetamemoryState = {
      metamemory: new Map(state.metamemory),
      threads: new Map(state.threads),
      lastProcessedIndex: state.lastProcessedIndex,
      lastProcessedTime: state.lastProcessedTime
    };

    // Apply thread operations first
    if (result.threadOperations) {
      this.applyThreadOperations(result.threadOperations, newState);
    }

    // Update message assignments
    const analyses = result.messageAnalysis || [];
    for (const analysis of analyses) {
      const message = windowMessages.find(m => m.id === analysis.messageId);
      if (!message || !message.id) continue;

      let messageLength = 0;
      if ('content' in message && message.content) {
        messageLength = typeof message.content === 'string' ? message.content.length : JSON.stringify(message.content).length;
      }

      const entry: MetamemoryEntry = {
        messageId: message.id,
        threadIds: analysis.threadIds,
        timestamp: Date.now(),
        messageLength: messageLength,
        importance: this.parseConfidence(analysis.confidence)
      };

      newState.metamemory.set(message.id, entry);

      // Update thread message lists
      for (const threadId of analysis.threadIds) {
        const thread = newState.threads.get(threadId);
        if (thread && !thread.messages.includes(message.id)) {
          thread.messages.push(message.id);
          thread.lastUpdated = Date.now();
        }
      }

      // New threads are created via threadOperations.create
    }

    // Check for threads that should be auto-completed
    this.checkThreadCompletion(newState, windowMessages);

    return newState;
  }

  private checkThreadCompletion(state: MetamemoryState, messages: ResponseInputItem[]): void {
    const completionKeywords = ['thanks', 'thank you', 'great', 'perfect', 'done', 'finished', 'bye', 'goodbye'];
    
    for (const [_threadId, thread] of state.threads) {
      if (thread.status === 'complete') continue;
      
      // Get the last few messages in this thread
      if (!thread.messages || thread.messages.length === 0) continue;
      
      const threadMessages = thread.messages.slice(-3).map(msgId => 
        messages.find(m => m.id === msgId)
      ).filter(Boolean);
      
      if (threadMessages.length === 0) continue;
      
      // Check if thread appears complete
      const lastMessage = threadMessages[threadMessages.length - 1];
      if (lastMessage && lastMessage.type === 'message') {
        const content = typeof lastMessage.content === 'string' ? 
          lastMessage.content.toLowerCase() : 
          JSON.stringify(lastMessage.content).toLowerCase();
        
        // Check for completion indicators
        const hasCompletionKeyword = completionKeywords.some(keyword => content.includes(keyword));
        const isAssistantFinalAnswer = lastMessage.role === 'assistant' && 
          (content.includes('i hope this helps') || 
           content.includes('let me know if') ||
           content.includes('is there anything else'));
        
        // Check for inactivity (no new messages for a while)
        const timeSinceLastUpdate = Date.now() - thread.lastUpdated;
        const isInactive = timeSinceLastUpdate > this.options.threadInactivityTimeout;
        
        if (hasCompletionKeyword || isAssistantFinalAnswer || isInactive) {
          thread.status = 'complete';
          thread.lastUpdated = Date.now();
        }
      }
    }
  }

  private parseConfidence(confidence: any): number {
    // Handle various confidence formats from LLM
    if (typeof confidence === 'number') {
      return Math.max(0, Math.min(100, confidence * 100));
    }
    
    if (typeof confidence === 'string') {
      const lowerConf = confidence.toLowerCase();
      switch (lowerConf) {
        case 'high': case 'exact': return 90;
        case 'medium': case 'moderate': return 70;
        case 'low': case 'weak': return 40;
        case 'very high': case 'certain': return 95;
        case 'very low': case 'uncertain': return 20;
        default:
          // Try to parse as number
          const parsed = parseFloat(confidence);
          if (!isNaN(parsed)) {
            return Math.max(0, Math.min(100, parsed));
          }
          return 50; // Default fallback
      }
    }
    
    return 50; // Default fallback for undefined/null
  }

  private applyThreadOperations(
    operations: MessageAnalysisResult['threadOperations'],
    state: MetamemoryState
  ): void {
    if (!operations) return;

    // Create new threads
    if (operations.create) {
      for (const create of operations.create) {
        // Skip if missing required fields
        if (!create.id || !create.name) {
          console.warn('[Metamemory] Skipping thread creation - missing id or name:', JSON.stringify(create));
          continue;
        }
        
        const thread: Thread = {
          id: create.id,
          name: create.name,
          messages: create.initialMessages || [],
          status: 'active',
          lastUpdated: Date.now(),
          class: 'active',
          createdAt: Date.now()
        };
        state.threads.set(create.id, thread);
      }
    }

    // Merge threads
    if (operations.merge) {
      for (const merge of operations.merge) {
        const targetThread = state.threads.get(merge.targetThread);
        if (!targetThread) continue;

        for (const sourceId of merge.sourceThreads) {
          const sourceThread = state.threads.get(sourceId);
          if (!sourceThread || sourceId === merge.targetThread) continue;

          // Move messages
          targetThread.messages.push(...sourceThread.messages);
          targetThread.lastUpdated = Date.now();

          // Update metamemory entries
          for (const messageId of sourceThread.messages) {
            const entry = state.metamemory.get(messageId);
            if (entry) {
              entry.threadIds = entry.threadIds.filter(id => id !== sourceId);
              if (!entry.threadIds.includes(merge.targetThread)) {
                entry.threadIds.push(merge.targetThread);
              }
            }
          }

          // Delete source thread
          state.threads.delete(sourceId);
        }
      }
    }

    // Close threads
    if (operations.close) {
      for (const threadId of operations.close) {
        const thread = state.threads.get(threadId);
        if (thread) {
          thread.status = 'complete';
          thread.lastUpdated = Date.now();
        }
      }
    }
  }
}