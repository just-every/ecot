import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Metamemory, createMetamemoryState } from '../src/metamemory';
import { TopicThreadManager } from '../src/metamemory/utils/topic-thread-manager';
import { InMemoryVectorSearch } from '../src/metamemory/utils/vector-search';
import { MessageTagger, TaggerLLM } from '../src/metamemory/tagger';
import { ThreadCompactor, SummarizerInterface } from '../src/metamemory/compactor';
import { ContextAssembler } from '../src/metamemory/context';
import type { 
  Message, 
  TaggedMessage, 
  TopicThread, 
  CompactionLevel,
  MetaMemoryConfig 
} from '../src/metamemory/types';
import type { ResponseInput, Agent } from '@just-every/ensemble';

// Mock implementations
class MockTaggerLLM implements TaggerLLM {
  async tag(messages: Message[], existingTopics: string[]): Promise<TaggedMessage[]> {
    return messages.map((msg, index) => ({
      messageId: msg.id,
      topics: index === 0 ? ['core'] : ['test_topic']
    }));
  }
}

class MockSummarizer implements SummarizerInterface {
  async summarize(
    thread: TopicThread,
    messagesToSummarize: number,
    level: CompactionLevel
  ): Promise<string> {
    return `Summary of ${messagesToSummarize} messages from topic ${thread.name}`;
  }
}

describe('MetaMemory System', () => {
  let mockAgent: Agent;
  
  beforeEach(() => {
    mockAgent = {
      name: 'TestAgent',
      generate: vi.fn().mockResolvedValue({ content: '[]' }),
      clone: vi.fn().mockReturnThis()
    } as any;
  });
  
  describe('TopicThreadManager', () => {
    let manager: TopicThreadManager;
    
    beforeEach(() => {
      manager = new TopicThreadManager();
    });
    
    it('should create and retrieve threads', () => {
      const thread = manager.createThread('test_topic', 'active');
      
      expect(thread.name).toBe('test_topic');
      expect(thread.state).toBe('active');
      expect(thread.messages).toHaveLength(0);
      
      const retrieved = manager.getThread('test_topic');
      expect(retrieved).toBe(thread);
    });
    
    it('should add messages to threads', () => {
      manager.createThread('test_topic', 'active');
      
      const message: Message = {
        id: 'msg_1',
        role: 'user',
        content: 'Test message',
        timestamp: Date.now()
      };
      
      manager.addMessageToThread('test_topic', message);
      
      const thread = manager.getThread('test_topic');
      expect(thread?.messages).toHaveLength(1);
      expect(thread?.messages[0]).toBe(message);
    });
    
    it('should track thread inactivity', () => {
      const thread = manager.createThread('test_topic', 'active');
      thread.lastActiveTimestamp = Date.now() - 65 * 60 * 1000; // 65 minutes ago
      
      expect(manager.isThreadInactive(thread, 60)).toBe(true);
      expect(manager.isThreadInactive(thread, 70)).toBe(false);
    });
    
    it('should handle thread relationships', () => {
      manager.createThread('parent_topic', 'active');
      manager.createThread('child_topic', 'active');
      
      manager.addThreadRelationship('child_topic', 'parent_topic');
      
      const relatedThreads = manager.getRelatedThreads('child_topic');
      expect(relatedThreads).toHaveLength(1);
      expect(relatedThreads[0].name).toBe('parent_topic');
    });
  });
  
  describe('MessageTagger', () => {
    let tagger: MessageTagger;
    let mockLLM: MockTaggerLLM;
    
    beforeEach(() => {
      mockLLM = new MockTaggerLLM();
      const config: MetaMemoryConfig = {
        maxTokensPerActiveThread: 20000,
        maxTokensPerIdleThread: 5000,
        inactivityThresholdMinutes: {
          activeToIdle: 60,
          idleToArchived: 1440
        },
        slidingWindowSize: 20,
        compactionInterval: 300000
      };
      tagger = new MessageTagger(mockLLM, config);
    });
    
    it('should tag messages using the LLM', async () => {
      const messages: ResponseInput = [
        { id: 'msg_1', role: 'user', content: 'Initial instructions' },
        { id: 'msg_2', role: 'assistant', content: 'Understood' }
      ];
      
      const taggedMessages = await tagger.tagMessages(messages, []);
      
      expect(taggedMessages).toHaveLength(2);
      expect(taggedMessages[0].topics).toContain('core');
      expect(taggedMessages[1].topics).toContain('test_topic');
    });
    
    it('should extract unique topics', async () => {
      const taggedMessages: TaggedMessage[] = [
        { messageId: 'msg_1', topics: ['topic_a', 'topic_b'] },
        { messageId: 'msg_2', topics: ['topic_b', 'topic_c'] },
        { messageId: 'msg_3', topics: ['topic_a'] }
      ];
      
      const uniqueTopics = tagger.extractUniqueTopics(taggedMessages);
      
      expect(uniqueTopics.size).toBe(3);
      expect(Array.from(uniqueTopics)).toEqual(['topic_a', 'topic_b', 'topic_c']);
    });
  });
  
  describe('ThreadCompactor', () => {
    let compactor: ThreadCompactor;
    let threadManager: TopicThreadManager;
    let mockSummarizer: MockSummarizer;
    let vectorSearch: InMemoryVectorSearch;
    
    beforeEach(() => {
      threadManager = new TopicThreadManager();
      mockSummarizer = new MockSummarizer();
      vectorSearch = new InMemoryVectorSearch();
      
      const config: MetaMemoryConfig = {
        maxTokensPerActiveThread: 100,
        maxTokensPerIdleThread: 50,
        inactivityThresholdMinutes: {
          activeToIdle: 1,
          idleToArchived: 2
        },
        slidingWindowSize: 20,
        compactionInterval: 1000
      };
      
      compactor = new ThreadCompactor(threadManager, config, mockSummarizer, vectorSearch);
    });
    
    it('should compact threads that exceed token limits', async () => {
      const thread = threadManager.createThread('test_topic', 'active');
      
      // Add many messages to exceed token limit AND preserve count
      for (let i = 0; i < 60; i++) {
        threadManager.addMessageToThread('test_topic', {
          id: `msg_${i}`,
          role: 'user',
          content: 'This is a long message that will contribute to the token count',
          timestamp: Date.now()
        });
      }
      
      await compactor.runCompactionCycle();
      
      const updatedThread = threadManager.getThread('test_topic');
      expect(updatedThread?.summary).toBeTruthy();
      expect(updatedThread?.messages.length).toBeLessThan(60);
      expect(updatedThread?.messages.length).toBe(50); // Should preserve latest 50
    });
    
    it('should transition threads between states', async () => {
      const thread = threadManager.createThread('test_topic', 'active');
      thread.lastActiveTimestamp = Date.now() - 1.5 * 60 * 1000; // 1.5 minutes ago
      
      await compactor.runCompactionCycle();
      
      const updatedThread = threadManager.getThread('test_topic');
      expect(updatedThread?.state).toBe('idle');
    });
  });
  
  describe('InMemoryVectorSearch', () => {
    let search: InMemoryVectorSearch;
    
    beforeEach(() => {
      search = new InMemoryVectorSearch();
    });
    
    it('should index and search threads', async () => {
      const thread1: TopicThread = {
        name: 'database_design',
        state: 'archived',
        messages: [],
        summary: 'Discussion about database schema design and optimization',
        lastActiveTimestamp: Date.now(),
        createdAt: Date.now(),
        tokenCount: 100
      };
      
      const thread2: TopicThread = {
        name: 'frontend_framework',
        state: 'archived',
        messages: [],
        summary: 'Comparison of React and Vue for the frontend',
        lastActiveTimestamp: Date.now(),
        createdAt: Date.now(),
        tokenCount: 100
      };
      
      await search.addThread(thread1);
      await search.addThread(thread2);
      
      const results = await search.search('database optimization', 2);
      
      expect(results).toHaveLength(2);
      expect(results[0].topicName).toBe('database_design');
      expect(results[0].relevanceScore).toBeGreaterThan(results[1].relevanceScore);
    });
  });

  describe('ContextAssembler', () => {
    let manager: TopicThreadManager;
    let assembler: ContextAssembler;

    beforeEach(() => {
      manager = new TopicThreadManager();
      assembler = new ContextAssembler(manager);
    });

    it('includes summaries of related threads for active topics', async () => {
      const active = manager.createThread('active_topic', 'active');
      active.summary = 'Active summary';
      manager.addMessageToThread('active_topic', {
        id: 'a1',
        role: 'user',
        content: 'hello',
        timestamp: Date.now()
      });

      const related = manager.createThread('related_topic', 'idle');
      related.summary = 'Related summary';
      manager.addThreadRelationship('active_topic', 'related_topic');

      const spy = vi.spyOn(manager, 'getRelatedThreads');

      const context = await assembler.buildContext([], {
        maxTokens: 1000,
        includeIdleSummaries: false,
        includeArchivedSearch: false,
        recentMessageCount: 5
      });

      expect(spy).toHaveBeenCalledWith('active_topic');
      const combined = context.map(m => ('content' in m ? m.content : '')).join(' ');
      expect(combined).toContain('Related summary');
    });
  });

  describe('Metamemory Integration', () => {
    let metamemory: Metamemory;
    
    beforeEach(() => {
      metamemory = new Metamemory({
        agent: mockAgent,
        taggerLLM: new MockTaggerLLM(),
        summarizer: new MockSummarizer()
      });
    });
    
    it('should process messages and create topic threads', async () => {
      const messages: ResponseInput = [
        { id: 'msg_1', role: 'user', content: 'Setup instructions' },
        { id: 'msg_2', role: 'assistant', content: 'Working on the task' }
      ];
      
      await metamemory.processMessages(messages);
      
      const stats = metamemory.getMemoryStats();
      expect(stats.coreThreads).toBe(1);
      expect(stats.activeThreads).toBeGreaterThan(0);
    });
    
    it('should build context with active and core threads', async () => {
      // First process some messages to create threads
      const messages: ResponseInput = [
        { id: 'msg_1', role: 'user', content: 'Core instructions' },
        { id: 'msg_2', role: 'assistant', content: 'Working on task' }
      ];
      
      await metamemory.processMessages(messages);
      
      // Build context
      const context = await metamemory.buildContext(messages, {
        maxTokens: 10000,
        includeIdleSummaries: true,
        includeArchivedSearch: false,
        recentMessageCount: 10
      });
      
      expect(context.length).toBeGreaterThan(0);
      expect(context.some(msg => msg.content?.includes('CORE INSTRUCTIONS'))).toBe(true);
    });
    
    it('should save and restore state', () => {
      const initialState = metamemory.getState();
      
      expect(initialState.threads.size).toBe(0);
      expect(initialState.lastProcessedIndex).toBe(0);
      
      // Restore a state with threads
      const savedState = createMetamemoryState();
      savedState.threads.set('test_thread', {
        id: 'test_thread',
        name: 'test_thread',
        messages: ['msg_1'],
        status: 'active',
        summary: 'Test summary',
        keyPoints: [],
        lastUpdated: Date.now(),
        class: 'active',
        createdAt: Date.now()
      });
      
      metamemory.restoreState(savedState);
      
      const newState = metamemory.getState();
      expect(newState.threads.size).toBe(1);
    });
  });
});