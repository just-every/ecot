import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ResponseInputItem, Agent } from '@just-every/ensemble';
import { Metamemory, createMetamemoryState } from '../src/metamemory/index.js';

// Mock agent for testing
const createMockAgent = () => {
  const generate = vi.fn();
  
  // Default mock for message tagging
  generate.mockImplementation(async (messages: any) => {
    const content = messages?.[0]?.content || '';
    
    if (content.includes('Tag the following messages')) {
      return {
        content: JSON.stringify({
          messages: [
            { message_id: 'msg1', topics: ['general', 'test'] },
            { message_id: 'msg2', topics: ['general', 'test'] },
            { message_id: 'msg3', topics: ['test'] },
            { message_id: 'msg4', topics: ['test'] },
            { message_id: 'msg5', topics: ['test'] }
          ],
          relationships: [
            { parent: 'general', child: 'test', relationship: 'parent-child' }
          ]
        })
      };
    }
    
    // Default mock for thread summarization
    if (content.includes('Please summarize this topic thread')) {
      return {
        content: `# Test Thread Summary

This thread discusses testing the metamemory system, including test messages and thread structure analysis.

## Key Points
- Created test messages for validation
- Analyzed thread structure and relationships

## Status
Active discussion about testing procedures.`
      };
    }
    
    return { content: JSON.stringify({ messages: [], relationships: [] }) };
  });
  
  return { generate } as unknown as Agent;
};

describe('Metamemory System', () => {
  let metamemory: Metamemory;
  let mockAgent: Agent;
  
  beforeEach(() => {
    mockAgent = createMockAgent();
    metamemory = new Metamemory({ agent: mockAgent });
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
        { type: 'message', role: 'user', content: 'Test message 3', id: 'msg3' },
        { type: 'message', role: 'assistant', content: 'Test response 4', id: 'msg4' },
        { type: 'message', role: 'user', content: 'Final test message', id: 'msg5' },
      ];

      // Process messages (need at least 5 to trigger processing)
      await metamemory.processMessages(messages);
      
      // Force processing to ensure it happens
      await metamemory.forceCompaction();

      // Get state to check results
      const state = metamemory.getState();
      
      // The mock should have created threads
      expect(state.threads.size).toBeGreaterThan(0);
      expect(state.lastProcessedIndex).toBe(5);
      
      // Check that threads were created
      let hasGeneralThread = false;
      let hasTestThread = false;
      
      for (const [_, thread] of state.threads) {
        if (thread.name === 'general') hasGeneralThread = true;
        if (thread.name === 'test') hasTestThread = true;
      }
      
      expect(hasGeneralThread || hasTestThread).toBe(true);
    });

    it('should not process when too few messages', async () => {
      const messages: ResponseInputItem[] = [
        { type: 'message', role: 'user', content: 'Message 1', id: 'msg1' },
        { type: 'message', role: 'user', content: 'Message 2', id: 'msg2' },
      ];

      await metamemory.processMessages(messages);
      
      const state = metamemory.getState();
      expect(state.threads.size).toBe(0); // No processing should have occurred
    });
  });

  describe('Context Building', () => {
    it('should build context from messages and threads', async () => {
      // First process some messages to create threads
      const messages: ResponseInputItem[] = [
        { type: 'message', role: 'user', content: 'Test message 1', id: 'msg1' },
        { type: 'message', role: 'assistant', content: 'Response 1', id: 'msg2' },
        { type: 'message', role: 'user', content: 'Test message 2', id: 'msg3' },
        { type: 'message', role: 'assistant', content: 'Response 2', id: 'msg4' },
        { type: 'message', role: 'user', content: 'Test message 3', id: 'msg5' },
      ];

      await metamemory.processMessages(messages);

      // Build context
      const context = await metamemory.buildContext(messages, {
        maxTokens: 10000,
        includeIdleSummaries: true,
        recentMessageCount: 3
      });

      // Should include recent messages
      expect(context.length).toBeGreaterThanOrEqual(3);
      
      // Check that recent messages are included
      const lastThreeMessages = context.slice(-3);
      expect(lastThreeMessages[0].id).toBe('msg3');
      expect(lastThreeMessages[1].id).toBe('msg4');
      expect(lastThreeMessages[2].id).toBe('msg5');
    });
  });

  describe('Core Topic Management', () => {
    it('should mark topics as core', () => {
      metamemory.markTopicAsCore('system-setup');
      
      const state = metamemory.getState();
      const systemThread = Array.from(state.threads.values()).find(t => t.name === 'system-setup');
      
      expect(systemThread).toBeDefined();
      expect(systemThread?.class).toBe('core');
    });
  });

  describe('State Persistence', () => {
    it('should save and restore state', async () => {
      // Process some messages
      const messages: ResponseInputItem[] = [
        { type: 'message', role: 'user', content: 'Message 1', id: 'msg1' },
        { type: 'message', role: 'assistant', content: 'Response 1', id: 'msg2' },
        { type: 'message', role: 'user', content: 'Message 2', id: 'msg3' },
        { type: 'message', role: 'assistant', content: 'Response 2', id: 'msg4' },
        { type: 'message', role: 'user', content: 'Message 3', id: 'msg5' },
      ];

      await metamemory.processMessages(messages);
      
      // Mark a topic as core
      metamemory.markTopicAsCore('important-topic');
      
      // Get state
      const savedState = metamemory.getState();
      
      // Create new instance and restore
      const newMetamemory = new Metamemory({ agent: mockAgent });
      newMetamemory.restoreState(savedState);
      
      const restoredState = newMetamemory.getState();
      
      // Check restoration
      expect(restoredState.threads.size).toBe(savedState.threads.size);
      expect(restoredState.lastProcessedIndex).toBe(savedState.lastProcessedIndex);
      
      // Check that core topic was preserved
      const importantThread = Array.from(restoredState.threads.values()).find(t => t.name === 'important-topic');
      expect(importantThread).toBeDefined();
      expect(importantThread?.class).toBe('core');
    });
  });

  describe('Memory Statistics', () => {
    it('should provide memory statistics', async () => {
      const messages: ResponseInputItem[] = [
        { type: 'message', role: 'user', content: 'Test message 1', id: 'msg1' },
        { type: 'message', role: 'assistant', content: 'Response 1', id: 'msg2' },
        { type: 'message', role: 'user', content: 'Test message 2', id: 'msg3' },
        { type: 'message', role: 'assistant', content: 'Response 2', id: 'msg4' },
        { type: 'message', role: 'user', content: 'Test message 3', id: 'msg5' },
      ];

      await metamemory.processMessages(messages);
      
      const stats = metamemory.getMemoryStats();
      
      expect(stats).toBeDefined();
      expect(stats.coreThreads).toBeGreaterThanOrEqual(0);
      expect(stats.activeThreads).toBeGreaterThanOrEqual(0);
      expect(stats.idleThreads).toBeGreaterThanOrEqual(0);
      expect(stats.archivedThreads).toBeGreaterThanOrEqual(0);
      expect(stats.totalMessages).toBeGreaterThanOrEqual(0);
      expect(stats.totalTokens).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Manual Compaction', () => {
    it('should allow manual compaction trigger', async () => {
      const messages: ResponseInputItem[] = [
        { type: 'message', role: 'user', content: 'Test message 1', id: 'msg1' },
        { type: 'message', role: 'assistant', content: 'Response 1', id: 'msg2' },
        { type: 'message', role: 'user', content: 'Test message 2', id: 'msg3' },
        { type: 'message', role: 'assistant', content: 'Response 2', id: 'msg4' },
        { type: 'message', role: 'user', content: 'Test message 3', id: 'msg5' },
      ];

      await metamemory.processMessages(messages);
      
      // Force compaction should not throw
      await expect(metamemory.forceCompaction()).resolves.not.toThrow();
    });
  });
});