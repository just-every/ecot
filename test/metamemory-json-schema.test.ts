import { describe, it, expect, vi } from 'vitest';
import { LLMTagger } from '../src/metamemory/tagger/llm-tagger.js';
import { LLMSummarizer } from '../src/metamemory/summarizer/index.js';

// Mock ensembleRequest to return JSON schema compliant responses
vi.mock('@just-every/ensemble', () => ({
  ensembleRequest: vi.fn(async function* (messages: any, agent: any) {
    // Check if JSON schema is being used
    const hasJsonSchema = agent.modelSettings?.json_schema;
    
    if (hasJsonSchema && hasJsonSchema.name === 'metamemory_tagger_response') {
      // Return properly formatted JSON for tagger
      yield {
        type: 'message_delta',
        content: JSON.stringify({
          messages: [
            { message_id: 'msg1', topic_tags: ['greeting'], summary: 'Simple greeting message' },
            { message_id: 'msg2', topic_tags: ['greeting', 'support'], summary: 'Friendly response greeting' },
            { message_id: 'msg3', topic_tags: ['technical', 'testing'], summary: 'Testing request initiated' }
          ],
          topic_tag_types: [
            { topic_tag: 'greeting', type: 'ephemeral', description: 'Basic greetings and pleasantries' },
            { topic_tag: 'support', type: 'active', description: 'User support interactions' },
            { topic_tag: 'technical', type: 'active', description: 'Technical discussions and implementations' },
            { topic_tag: 'testing', type: 'active', description: 'Testing related activities' }
          ]
        })
      };
    } else if (hasJsonSchema && hasJsonSchema.name === 'thread_summary_response') {
      // Return properly formatted JSON for summarizer
      yield {
        type: 'message_delta',
        content: JSON.stringify({
          summary: 'This thread discusses testing the metamemory system.',
          key_points: [
            'Implemented JSON schema for LLM requests',
            'Fixed tagger implementation to use ensembleRequest',
            'Added comprehensive test coverage'
          ],
          open_questions: [
            'How to handle edge cases in message processing?'
          ],
          next_steps: 'Continue improving test coverage and error handling',
          current_status: 'System is functional with JSON schema support'
        })
      };
    } else {
      // Fallback response
      yield {
        type: 'message_delta',
        content: 'Mock response without schema'
      };
    }
  }),
  cloneAgent: vi.fn((agent) => ({ ...agent })),
  truncateLargeValues: vi.fn().mockImplementation((obj, maxLength = 1000) => {
    if (typeof obj === 'string') {
      return obj.length > maxLength ? obj.substring(0, maxLength) + '...' : obj;
    }
    return obj;
  })
}));

describe('Metamemory JSON Schema Implementation', () => {
  describe('LLMTagger with JSON Schema', () => {
    it('should use JSON schema for tagging requests', async () => {
      const mockAgent = {
        name: 'TestAgent',
        modelClass: 'standard',
        model: 'test-model'
      };
      
      const messages = [
        { id: 'msg1', role: 'user' as const, content: 'Hello!', timestamp: Date.now() },
        { id: 'msg2', role: 'assistant' as const, content: 'Hi there!', timestamp: Date.now() },
        { id: 'msg3', role: 'user' as const, content: 'I need to test something', timestamp: Date.now() }
      ];
      
      const result = await LLMTagger.tag(messages, new Map(), new Map(), mockAgent as any);
      
      // Verify the result has the correct structure
      expect(result).toHaveProperty('topicTags');
      expect(result).toHaveProperty('taggedMessages');
      
      // Verify tagged messages
      expect(result.taggedMessages.size).toBe(3);
      expect(result.taggedMessages.get('msg1')).toMatchObject({
        message_id: 'msg1',
        topic_tags: ['greeting'],
        summary: 'Simple greeting message'
      });
      expect(result.taggedMessages.get('msg2')).toMatchObject({
        message_id: 'msg2',
        topic_tags: ['greeting', 'support'],
        summary: 'Friendly response greeting'
      });
      expect(result.taggedMessages.get('msg3')).toMatchObject({
        message_id: 'msg3',
        topic_tags: ['technical', 'testing'],
        summary: 'Testing request initiated'
      });
      
    });
  });
  
  describe('LLMSummarizer with JSON Schema', () => {
    it('should use JSON schema for summarization requests', async () => {
      const mockAgent = {
        name: 'TestAgent',
        modelClass: 'standard',
        model: 'test-model'
      };
      
      const summarizer = new LLMSummarizer(mockAgent as any);
      
      const thread = {
        name: 'test_thread',
        state: 'active' as const,
        messages: [
          { id: 'msg1', role: 'user' as const, content: 'Test message 1', timestamp: Date.now() },
          { id: 'msg2', role: 'assistant' as const, content: 'Test response 1', timestamp: Date.now() }
        ],
        tokenCount: 100,
        lastActiveTimestamp: Date.now(),
        createdAt: Date.now(),
        summary: '',
        metadata: {}
      };
      
      const compactionLevel = {
        level: 'light' as const,
        maxTokens: 1000
      };
      
      const result = await summarizer.summarize(thread, 2, compactionLevel);
      
      // Verify the result contains structured content
      expect(result).toContain('This thread discusses testing the metamemory system');
      expect(result).toContain('Key Points:');
      expect(result).toContain('• Implemented JSON schema for LLM requests');
      expect(result).toContain('Open Questions:');
      expect(result).toContain('Next Steps:');
      expect(result).toContain('Current Status:');
    });
  });
});