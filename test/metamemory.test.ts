import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ResponseInputItem, Agent } from '@just-every/ensemble';
import {
  Metamemory,
  createMetamemoryState,
  type MetamemoryState,
  type CompactionResult,
  type ThreadClass,
} from '../src/metamemory-old/index.js';

vi.mock('@just-every/ensemble', async (importOriginal) => {
  const original: any = await importOriginal();
  return {
    ...original,
    ensembleRequest: vi.fn(async function* (_messages: any, agent: any) {
      const instr = agent.instructions as string;
      if (instr.includes('Analyze the following conversation messages')) {
        yield {
          type: 'response_output',
          message: {
            type: 'message',
            role: 'assistant',
            content: JSON.stringify({
              messageAnalysis: [
                { messageId: 'msg1', threadIds: ['thread1'], confidence: 0.9 },
                { messageId: 'msg2', threadIds: ['thread1'], confidence: 0.85 }
              ],
              threadOperations: {
                create: [
                  { id: 'thread1', name: 'Test Thread', initialMessages: ['msg1'] }
                ]
              },
              reasoning: ''
            })
          }
        };
      } else if (instr.includes('Summarize the following conversation thread')) {
        yield {
          type: 'response_output',
          message: {
            type: 'message',
            role: 'assistant',
            content: JSON.stringify({
              threadId: 'thread1',
              title: 'Test Thread Summary',
              class: 'active',
              keySummary: 'This thread discusses testing the metamemory system.',
              keyPoints: ['Created test messages', 'Analyzed thread structure'],
              status: 'active',
              importance: 75
            })
          }
        };
      } else {
        yield { type: 'response_output', message: { type: 'message', role: 'assistant', content: '{}' } };
      }
    })
  };
});

// Mock agent for testing
const createMockAgent = () => {
  const runAgent = vi.fn();
  
  // Default mock for message analysis
  runAgent.mockImplementation(async (prompt: string) => {
    if (prompt.includes('Analyze the following conversation messages')) {
      return {
        response: {
          tool_calls: [{
            name: 'analyze_messages',
            arguments: {
              messageAnalysis: [
                {
                  messageId: 'msg1',
                  threadIds: ['thread1'],
                  confidence: 0.9,
                },
                {
                  messageId: 'msg2',
                  threadIds: ['thread1'],
                  confidence: 0.85,
                }
              ],
              threadOperations: {
                create: [{
                  id: 'thread1',
                  name: 'Test Thread',
                  initialMessages: ['msg1']
                }]
              }
            }
          }]
        }
      };
    }
    
    // Default mock for thread summarization
    if (prompt.includes('Summarize the following conversation thread')) {
      return {
        response: {
          tool_calls: [{
            name: 'summarize_thread',
            arguments: {
              threadId: 'thread1',
              title: 'Test Thread Summary',
              class: 'active' as ThreadClass,
              keySummary: 'This thread discusses testing the metamemory system.',
              keyPoints: ['Created test messages', 'Analyzed thread structure'],
              status: 'active',
              importance: 75
            }
          }]
        }
      };
    }
  });
  
  return { runAgent } as unknown as Agent;
};

describe('Metamemory System', () => {
  let metamemory: Metamemory;
  let state: MetamemoryState;
  let mockAgent: Agent;
  
  beforeEach(() => {
    metamemory = new Metamemory({
      windowSize: 10,
      processInterval: 3,
    });
    state = createMetamemoryState();
    mockAgent = createMockAgent();
  });

  describe('State Initialization', () => {
    it('should create empty state correctly', () => {
      const newState = createMetamemoryState();
      expect(newState.metamemory.size).toBe(0);
      expect(newState.threads.size).toBe(0);
      expect(newState.lastProcessedIndex).toBe(0);
      expect(newState.lastProcessedTime).toBeGreaterThan(0);
    });
  });

  describe('Message Processing', () => {
    it('should process messages and create threads', async () => {
      const messages: ResponseInputItem[] = [
        { type: 'message', role: 'user', content: 'Hello', id: 'msg1' },
        { type: 'message', role: 'assistant', content: 'Hi there!', id: 'msg2' },
      ];

      const updatedState = await metamemory.processMessages(
        messages,
        state,
        mockAgent,
        { type: 'manual' }
      );

      expect(updatedState.metamemory.size).toBe(2);
      expect(updatedState.threads.size).toBe(1);
      expect(updatedState.lastProcessedIndex).toBe(2);
      
      const thread = updatedState.threads.get('thread1');
      expect(thread).toBeDefined();
      expect(thread?.name).toBe('Test Thread');
      expect(thread?.messages).toContain('msg1');
    });

    it('should respect processing interval', async () => {
      const messages: ResponseInputItem[] = [
        { type: 'message', role: 'user', content: 'Message 1', id: 'msg1' },
        { type: 'message', role: 'user', content: 'Message 2', id: 'msg2' },
      ];

      // First process shouldn't trigger (less than interval)
      const state1 = await metamemory.processMessages(messages, state, mockAgent);
      expect(state1.lastProcessedIndex).toBe(0);

      // Add more messages to trigger processing
      const moreMessages = [
        ...messages,
        { role: 'user', content: 'Message 3', id: 'msg3' },
        { role: 'user', content: 'Message 4', id: 'msg4' },
      ];

      const state2 = await metamemory.processMessages(
        moreMessages,
        state1,
        mockAgent
      );
      expect(state2.lastProcessedIndex).toBe(4);
    });
  });

  describe('Thread Summarization', () => {
    it('should summarize threads correctly', async () => {
      // Set up state with a thread
      state.threads.set('thread1', {
        id: 'thread1',
        name: 'Test Thread',
        messages: ['msg1', 'msg2', 'msg3', 'msg4', 'msg5'],
        status: 'active',
        class: 'active',
        lastUpdated: Date.now(),
        createdAt: Date.now(),
      });

      const messages: ResponseInputItem[] = [
        { type: 'message', role: 'user', content: 'Message 1', id: 'msg1' },
        { type: 'message', role: 'assistant', content: 'Response 1', id: 'msg2' },
        { type: 'message', role: 'user', content: 'Message 2', id: 'msg3' },
        { type: 'message', role: 'assistant', content: 'Response 2', id: 'msg4' },
        { type: 'message', role: 'user', content: 'Message 3', id: 'msg5' },
      ];

      const updatedState = await metamemory.summarizeThreads(
        state,
        messages,
        mockAgent
      );

      const thread = updatedState.threads.get('thread1');
      expect(thread?.summary).toBe('This thread discusses testing the metamemory system.');
      expect(thread?.keyPoints).toHaveLength(2);
    });
  });

  describe('History Compaction', () => {
    it('should compact messages by thread class', async () => {
      // Set up state with different thread classes
      state.threads.set('core-thread', {
        id: 'core-thread',
        name: 'System Setup',
        messages: ['msg1'],
        status: 'active',
        class: 'core',
        lastUpdated: Date.now(),
        createdAt: Date.now(),
      });

      state.threads.set('ephemeral-thread', {
        id: 'ephemeral-thread',
        name: 'Casual Chat',
        messages: ['msg2', 'msg3'],
        status: 'complete',
        class: 'ephemeral',
        summary: 'Brief social interaction',
        lastUpdated: Date.now(),
        createdAt: Date.now(),
      });

      state.metamemory.set('msg1', {
        messageId: 'msg1',
        threadIds: ['core-thread'],
        timestamp: Date.now(),
        messageLength: 100,
      });

      state.metamemory.set('msg2', {
        messageId: 'msg2',
        threadIds: ['ephemeral-thread'],
        timestamp: Date.now(),
        messageLength: 50,
      });

      state.metamemory.set('msg3', {
        messageId: 'msg3',
        threadIds: ['ephemeral-thread'],
        timestamp: Date.now(),
        messageLength: 50,
      });

      const messages: ResponseInputItem[] = [
        { type: 'message', role: 'system', content: 'System setup message', id: 'msg1' },
        { type: 'message', role: 'user', content: 'Hi there!', id: 'msg2' },
        { type: 'message', role: 'assistant', content: 'Hello!', id: 'msg3' },
      ];

      const result: CompactionResult = await metamemory.compactHistory(
        messages,
        state
      );

      expect(result.metadata.originalCount).toBe(3);
      expect(result.metadata.threadsPreserved).toContain('core-thread');
      expect(result.metadata.threadsSummarized).toContain('ephemeral-thread');
      
      // Core thread messages should be preserved
      const coreMessage = result.messages.find(m => 
        m.content === 'System setup message'
      );
      expect(coreMessage).toBeDefined();
      expect(coreMessage?.isCompacted).toBe(false);

      // Ephemeral thread should be summarized
      const ephemeralSummary = result.messages.find(m =>
        m.content.includes('Brief social interaction') && m.isCompacted
      );
      expect(ephemeralSummary).toBeDefined();
      expect(ephemeralSummary?.isCompacted).toBe(true);
      expect(ephemeralSummary?.content).toContain('Brief social interaction');
    });

    it('should handle orphaned messages', async () => {
      const messages: ResponseInputItem[] = [
        { type: 'message', role: 'user', content: 'Orphaned message 1', id: 'orphan1' },
        { type: 'message', role: 'user', content: 'Orphaned message 2', id: 'orphan2' },
      ];

      const result = await metamemory.compactHistory(messages, state);
      
      // When >50% messages are orphaned, return original messages
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].content).toBe('Orphaned message 1');
      expect(result.messages[1].content).toBe('Orphaned message 2');
      expect(result.messages[0].isCompacted).toBe(false);
      expect(result.messages[1].isCompacted).toBe(false);
    });
  });

  describe('Processing Triggers', () => {
    it('should detect when processing is needed', () => {
      const messages = Array(5).fill(null).map((_, i) => ({
        role: 'user' as const,
        content: `Message ${i}`,
        id: `msg${i}`,
      }));

      const trigger = metamemory.shouldProcess(messages, state);
      expect(trigger).not.toBeNull();
      expect(trigger?.type).toBe('interval');
    });

    it('should detect large messages', () => {
      const messages: ResponseInputItem[] = [{
        type: 'message',
        role: 'user',
        content: 'x'.repeat(3000),
        id: 'large-msg',
      }];

      const trigger = metamemory.shouldProcess(messages, state, 3000);
      expect(trigger).not.toBeNull();
      expect(trigger?.type).toBe('large_message');
    });

    it('should detect time gaps', () => {
      const oldState: MetamemoryState = {
        ...state,
        lastProcessedTime: Date.now() - 120000, // 2 minutes ago
      };

      const messages: ResponseInputItem[] = [{ type: 'message', role: 'user', content: 'New message', id: 'msg1' }];
      const trigger = metamemory.shouldProcess(messages, oldState);
      expect(trigger).not.toBeNull();
      expect(trigger?.type).toBe('time_gap');
    });
  });
});