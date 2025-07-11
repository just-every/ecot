import {
    MetaMemoryConfig,
    MetamemoryState,
    MessageMetadata,
    TopicTagMetadata
} from './types/index.js';
import { LLMTagger } from './tagger/llm-tagger.js';
import type { ResponseInput, ResponseInputItem, Agent } from '@just-every/ensemble';

export interface MetaMemoryOptions {
    config?: Partial<MetaMemoryConfig>;
    agent: Agent;
}

export class Metamemory {
    private taggedMessages: Map<string, MessageMetadata> = new Map();
    private topicTags: Map<string, TopicTagMetadata> = new Map();
    private config: MetaMemoryConfig;
    private isProcessing: boolean = false;
    private messageQueue: ResponseInputItem[] = [];
    private lastProcessedIndex: number = 0;
    private agent: Agent;

    constructor(options: MetaMemoryOptions) {
        // Initialize config with defaults
        this.config = {
            slidingWindowSize: 20,
            processingThreshold: 1,
            ...options.config
        };

        this.agent = options.agent;
    }

    /**
     * Process new messages and update message metadata
     */
    async processMessages(messages: ResponseInput): Promise<{
        newTopicCount?: number;
        updatedTopicCount?: number;
        newMessageCount?: number;
        updatedMessageCount?: number;
    }> {
        if (!Array.isArray(messages) || messages.length === 0) {
            console.warn('[MetaMemory] No messages to process.');
            return {};
        }

        // Add new messages to the queue
        const newMessages = messages.slice(this.lastProcessedIndex);
        this.messageQueue.push(...newMessages);
        this.lastProcessedIndex = messages.length;

        // Don't process if already processing
        if (this.isProcessing) {
            console.warn('[MetaMemory] Already processing messages, skipping new batch.');
            return {};
        }

        // Determine if processing should run
        const threshold = this.config.processingThreshold;
        if (this.messageQueue.length < threshold) {
            return {};
        }

        this.isProcessing = true;

        try {
            // Get the sliding window of recent messages
            const windowSize = this.config.slidingWindowSize;

            // Also get windowSize messages from the original messages array
            let recentMessages: ResponseInputItem[] = [];

            if (this.lastProcessedIndex > windowSize) {
                // Get windowSize messages from the original messages array
                const startIndex = this.lastProcessedIndex - windowSize;
                recentMessages = messages.slice(startIndex, this.lastProcessedIndex);
            } else if (this.lastProcessedIndex > 0) {
                // Get all available messages if less than windowSize
                recentMessages = messages.slice(0, this.lastProcessedIndex);
            }

            // Add messages from the queue (up to windowSize)
            recentMessages = recentMessages.concat(this.messageQueue);

            // Tag the messages with raw JSON
            const {
                topicTags,
                taggedMessages,
                newTopicCount,
                updatedTopicCount,
                newMessageCount,
                updatedMessageCount
            } = await LLMTagger.tag(
                recentMessages,
                this.topicTags,
                this.taggedMessages,
                this.agent
            );

            // Update topic tags
            this.topicTags = topicTags;

            // Update tagged messages with all tagged messages (includes existing + new)
            this.taggedMessages = taggedMessages;

            // Remove successfully tagged messages from queue
            this.messageQueue = this.messageQueue.filter(msg => {
                // Handle both 'id' and 'message_id' field names
                const messageId = msg.id || (msg as any).message_id;
                if (!messageId) {
                    console.error('[MetaMemory] Message without ID found:', msg);
                    throw new Error('[MetaMemory] Message without ID found in queue - this should not happen');
                }
                return !taggedMessages.has(messageId);
            });

            return {
                newTopicCount,
                updatedTopicCount,
                newMessageCount,
                updatedMessageCount
            };

        } catch (error) {
            console.error('[MetaMemory] Error processing messages:', error);
        } finally {
            this.isProcessing = false;
        }

        return {};
    }

    /**
     * Get messages by topic
     */
    getMessagesByTopic(topic: string): MessageMetadata[] {
        const messages: MessageMetadata[] = [];
        for (const metadata of this.taggedMessages.values()) {
            if (metadata.topic_tags.includes(topic)) {
                messages.push(metadata);
            }
        }
        return messages;
    }

    /**
     * Get all topics
     */
    getAllTopics(): string[] {
        return Array.from(this.topicTags.keys());
    }

    /**
     * Get the current state of metamemory
     */
    getState(): MetamemoryState {
        return {
            topicTags: new Map(this.topicTags),
            taggedMessages: new Map(this.taggedMessages),
            lastProcessedIndex: this.lastProcessedIndex,
        };
    }

    /**
     * Restore metamemory from a saved state
     */
    restoreState(state: MetamemoryState): void {
        this.topicTags = new Map(state.topicTags);
        this.taggedMessages = new Map(state.taggedMessages);
        this.lastProcessedIndex = state.lastProcessedIndex;
    }

    /**
     * Get memory statistics
     */
    getMemoryStats() {
        return {
            totalMessages: this.taggedMessages.size,
            totalTopics: this.topicTags.size,
            lastProcessedIndex: this.lastProcessedIndex
        };
    }
}

export type { MetamemoryState } from './types/index.js';