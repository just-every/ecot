import { TopicThread, TopicThreadStore, Message, TopicState } from '../types/index.js';

export class TopicThreadManager {
  private threads: TopicThreadStore = {};

  createThread(topicName: string, initialState: TopicState = 'active'): TopicThread {
    if (this.threads[topicName]) {
      return this.threads[topicName];
    }

    const thread: TopicThread = {
      name: topicName,
      state: initialState,
      messages: [],
      summary: '',
      lastActiveTimestamp: Date.now(),
      createdAt: Date.now(),
      tokenCount: 0,
      relationships: []
    };

    this.threads[topicName] = thread;
    return thread;
  }

  getThread(topicName: string): TopicThread | undefined {
    return this.threads[topicName];
  }

  getAllThreads(): TopicThread[] {
    return Object.values(this.threads);
  }

  getThreadsByState(state: TopicState): TopicThread[] {
    return Object.values(this.threads).filter(thread => thread.state === state);
  }

  addMessageToThread(topicName: string, message: Message): void {
    const thread = this.threads[topicName];
    if (!thread) {
      throw new Error(`Thread ${topicName} does not exist`);
    }

    // Check if message already exists in thread
    const messageExists = thread.messages.some(m => m.id === message.id);
    if (!messageExists) {
      thread.messages.push(message);
      thread.lastActiveTimestamp = Date.now();
      thread.tokenCount = this.estimateTokenCount(thread);
    }
  }

  updateThreadState(topicName: string, newState: TopicState): void {
    const thread = this.threads[topicName];
    if (!thread) {
      throw new Error(`Thread ${topicName} does not exist`);
    }
    thread.state = newState;
  }

  updateThreadSummary(topicName: string, summary: string): void {
    const thread = this.threads[topicName];
    if (!thread) {
      throw new Error(`Thread ${topicName} does not exist`);
    }
    thread.summary = summary;
  }

  isThreadInactive(thread: TopicThread, thresholdMinutes: number): boolean {
    const now = Date.now();
    const inactiveTime = now - thread.lastActiveTimestamp;
    return inactiveTime > thresholdMinutes * 60 * 1000;
  }

  getRecentMessages(thread: TopicThread, count: number): Message[] {
    return thread.messages.slice(-count);
  }

  compactThread(topicName: string, keepRecentCount: number = 50): Message[] {
    const thread = this.threads[topicName];
    if (!thread) {
      throw new Error(`Thread ${topicName} does not exist`);
    }

    const messagesToCompact = thread.messages.slice(0, -keepRecentCount);
    thread.messages = thread.messages.slice(-keepRecentCount);
    thread.tokenCount = this.estimateTokenCount(thread);
    
    return messagesToCompact;
  }

  addThreadRelationship(topicName: string, relatedTopic: string): void {
    const thread = this.threads[topicName];
    if (!thread) {
      throw new Error(`Thread ${topicName} does not exist`);
    }

    if (!thread.relationships) {
      thread.relationships = [];
    }

    if (!thread.relationships.includes(relatedTopic)) {
      thread.relationships.push(relatedTopic);
    }
  }

  getRelatedThreads(topicName: string): TopicThread[] {
    const thread = this.threads[topicName];
    if (!thread || !thread.relationships) {
      return [];
    }

    return thread.relationships
      .map(relatedName => this.threads[relatedName])
      .filter(t => t !== undefined);
  }

  private estimateTokenCount(thread: TopicThread): number {
    // Simple estimation: ~4 characters per token
    const messageText = thread.messages
      .map(m => m.content)
      .join(' ');
    const summaryText = thread.summary || '';
    const totalText = messageText + ' ' + summaryText;
    return Math.ceil(totalText.length / 4);
  }

  exportThreads(): TopicThreadStore {
    return { ...this.threads };
  }

  importThreads(threads: TopicThreadStore): void {
    this.threads = { ...threads };
  }
}