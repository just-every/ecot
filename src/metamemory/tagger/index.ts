import { Message, TaggedMessage, MetaMemoryConfig } from '../types/index.js';
import type { ResponseInputItem } from '@just-every/ensemble';

export interface TaggerLLM {
  tag(messages: Message[], existingTopics: string[]): Promise<TaggedMessage[]>;
}

export class MessageTagger {
  private llm: TaggerLLM;
  private config: MetaMemoryConfig;
  
  constructor(llm: TaggerLLM, config: MetaMemoryConfig) {
    this.llm = llm;
    this.config = config;
  }
  
  /**
   * Convert ensemble ResponseInputItem to our Message format
   */
  private convertToMessage(item: ResponseInputItem): Message {
    return {
      id: item.id || `msg_${Date.now()}_${Math.random()}`,
      role: 'role' in item ? item.role as Message['role'] : 'user',
      content: 'content' in item && typeof item.content === 'string' 
        ? item.content 
        : 'content' in item ? JSON.stringify(item.content) : '',
      timestamp: Date.now(),
      metadata: {}
    };
  }
  
  /**
   * Tag a sliding window of recent messages
   */
  async tagMessages(
    recentItems: ResponseInputItem[],
    existingTopics: string[]
  ): Promise<TaggedMessage[]> {
    // Convert to our message format
    const messages = recentItems.map(item => this.convertToMessage(item));
    
    // Get the sliding window
    const windowSize = Math.min(this.config.slidingWindowSize, messages.length);
    const messagesToTag = messages.slice(-windowSize);
    
    // Call the LLM to tag messages
    const taggedMessages = await this.llm.tag(messagesToTag, existingTopics);
    
    return taggedMessages;
  }
  
  /**
   * Extract unique topics from tagged messages
   */
  extractUniqueTopics(taggedMessages: TaggedMessage[]): Set<string> {
    const topics = new Set<string>();
    
    for (const taggedMsg of taggedMessages) {
      for (const topic of taggedMsg.topics) {
        topics.add(topic);
      }
    }
    
    return topics;
  }
  
  /**
   * Filter out ephemeral messages
   */
  filterEphemeralMessages(taggedMessages: TaggedMessage[]): TaggedMessage[] {
    return taggedMessages.filter(msg => !msg.topics.includes('ephemeral'));
  }
}