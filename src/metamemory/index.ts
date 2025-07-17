import {
    MetaMemoryConfig,
    MetamemoryState,
    MessageMetadata,
    TopicTagMetadata,
    TopicCompaction
} from './types/index.js';
import { LLMTagger } from './tagger/llm-tagger.js';
import type { ResponseInput, ResponseInputItem, Agent } from '@just-every/ensemble';
import { ensembleRequest } from '@just-every/ensemble';
import { v4 as uuidv4 } from 'uuid';
import { approximateTokens } from '../utils/index.js';

export interface MetaMemoryOptions {
    config?: Partial<MetaMemoryConfig>;
    agent: Agent;
}

export class Metamemory {
    private taggedMessages: Map<string, MessageMetadata> = new Map();
    private topicTags: Map<string, TopicTagMetadata> = new Map();
    private topicCompaction: Map<string, TopicCompaction[]> = new Map();
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
                updatedMessageCount,
                mergedTopics
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
            
            // Handle merged topics and compaction
            if (mergedTopics && mergedTopics.length > 0) {
                await this.handleMergedTopics(mergedTopics);
            }

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
            topicCompaction: new Map(this.topicCompaction),
            lastProcessedIndex: this.lastProcessedIndex,
        };
    }

    /**
     * Restore metamemory from a saved state
     */
    restoreState(state: MetamemoryState): void {
        this.topicTags = new Map(state.topicTags);
        this.taggedMessages = new Map(state.taggedMessages);
        this.topicCompaction = state.topicCompaction ? new Map(state.topicCompaction) : new Map();
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

    /**
     * Check and perform compaction on topics as needed
     */
    async checkCompact(messages: ResponseInput): Promise<void> {
        // Step 1: Calculate target_compaction for each topicTag
        const now = Date.now();
        
        for (const [, tagMeta] of this.topicTags) {
            // Calculate age in seconds
            const ageInSeconds = (now - tagMeta.last_update) / 1000;
            
            // Determine target compaction based on type and age
            let targetCompaction = 0;
            
            switch (tagMeta.type) {
                case 'core':
                    // Core topics: minimal compaction
                    if (ageInSeconds > 3600) targetCompaction = 10; // After 1 hour
                    if (ageInSeconds > 86400) targetCompaction = 20; // After 1 day
                    break;
                    
                case 'active':
                    // Active topics: moderate compaction
                    if (ageInSeconds > 1800) targetCompaction = 30; // After 30 min
                    if (ageInSeconds > 7200) targetCompaction = 50; // After 2 hours
                    if (ageInSeconds > 86400) targetCompaction = 70; // After 1 day
                    break;
                    
                case 'idle':
                    // Idle topics: aggressive compaction
                    if (ageInSeconds > 600) targetCompaction = 50; // After 10 min
                    if (ageInSeconds > 3600) targetCompaction = 80; // After 1 hour
                    if (ageInSeconds > 86400) targetCompaction = 90; // After 1 day
                    break;
                    
                case 'archived':
                    // Archived topics: maximum compaction
                    targetCompaction = 100;
                    break;
                    
                case 'ephemeral':
                    // Ephemeral topics: quick compaction
                    if (ageInSeconds > 300) targetCompaction = 70; // After 5 min
                    if (ageInSeconds > 1800) targetCompaction = 100; // After 30 min
                    break;
            }
            
            // Update the target_compaction_percent
            tagMeta.target_compaction_percent = targetCompaction;
        }
        
        // Step 2: Check if we need to generate new compactions
        for (const [tagName, tagMeta] of this.topicTags) {
            const targetCompaction = tagMeta.target_compaction_percent || 0;
            
            // Skip if no compaction needed
            if (targetCompaction === 0) continue;
            
            // Get messages for this topic
            const topicMessages = this.getMessagesByTopic(tagName);
            if (topicMessages.length === 0) continue;
            
            // Get relevant messages from input for accurate token counting
            const messageIds = new Set(topicMessages.map(m => m.message_id));
            const relevantMessages = messages.filter(msg => {
                const msgId = msg.id || (msg as any).message_id;
                return msgId && messageIds.has(msgId);
            });
            
            // Calculate total tokens using the proper token counter
            const totalTokens = approximateTokens(relevantMessages, this.agent.model || 'gpt-4o') as number;
            
            // Skip if too few tokens
            if (totalTokens < 100) continue;
            
            // Check if enough time has passed since last message
            const lastMessageTime = Math.max(...topicMessages.map(m => m.last_update));
            const timeSinceLastMessage = (now - lastMessageTime) / 1000;
            
            // Get existing compactions for this topic
            const existingCompactions = this.topicCompaction.get(tagName) || [];
            
            // Check if we need a new compaction
            let needsNewCompaction = true;
            
            for (const compaction of existingCompactions) {
                const compactionPercent = (compaction.compacted_tokens / totalTokens) * 100;
                // Check if we have a compaction within ±10% of target
                if (Math.abs(compactionPercent - targetCompaction) <= 10) {
                    needsNewCompaction = false;
                    break;
                }
            }
            
            // Generate new compaction if needed
            if (needsNewCompaction && (totalTokens > 100 || timeSinceLastMessage > 100)) {
                await this.generateCompaction(tagName, messages, targetCompaction, totalTokens);
            }
        }
    }

    /**
     * Generate a compaction for a topic
     */
    private async generateCompaction(
        tagName: string, 
        messages: ResponseInput, 
        targetCompaction: number,
        totalTokens: number
    ): Promise<void> {
        // Get messages for this topic
        const topicMessages = this.getMessagesByTopic(tagName);
        if (topicMessages.length === 0) return;
        
        // Sort messages by their appearance in the original messages array
        const messageIds = new Set(topicMessages.map(m => m.message_id));
        const relevantMessages = messages.filter(msg => {
            const msgId = msg.id || (msg as any).message_id;
            return msgId && messageIds.has(msgId);
        });
        
        // Calculate target tokens to include (with +10% buffer)
        const targetTokens = Math.ceil(totalTokens * (targetCompaction + 10) / 100);
        
        // Handle edge cases
        if (targetCompaction === 100) {
            // Full compaction - include all messages
            await this.createCompactionSummary(tagName, relevantMessages, totalTokens);
        } else if (targetTokens - totalTokens < 100) {
            // Too close to existing content, skip
            return;
        } else {
            // Partial compaction - include messages up to target tokens
            let includedTokens = 0;
            const messagesToCompact = [];
            
            for (let i = 0; i < relevantMessages.length; i++) {
                const msg = relevantMessages[i];
                // Calculate tokens for this single message
                const msgTokens = approximateTokens([msg], this.agent.model || 'gpt-4o') as number;
                
                if (includedTokens + msgTokens <= targetTokens) {
                    messagesToCompact.push(msg);
                    includedTokens += msgTokens;
                } else {
                    break;
                }
            }
            
            if (messagesToCompact.length > 0) {
                await this.createCompactionSummary(tagName, messagesToCompact, includedTokens);
            }
        }
    }

    /**
     * Create a compaction summary using the agent
     */
    private async createCompactionSummary(
        tagName: string,
        messages: ResponseInputItem[],
        compactedTokens: number
    ): Promise<void> {
        try {
            // Build prompt for summary
            const prompt = `Summarize the following messages related to topic "${tagName}". Focus on key information and maintain context:

Messages:
${messages.map((msg, idx) => {
    const role = (msg as any).role || 'unknown';
    const content = (msg as any).content || '';
    return `${idx + 1}. [${role}]: ${content}`;
}).join('\n\n')}

Provide a concise summary that captures the essential information.`;
            
            // Use the agent to generate summary
            const summaryMessages: ResponseInput = [{
                type: 'message',
                role: 'user',
                content: prompt,
                id: uuidv4()
            }];
            
            // Make request to agent
            let summary = '';
            for await (const event of ensembleRequest(summaryMessages, this.agent)) {
                if (event.type === 'response_output' && (event as any).message?.content) {
                    summary = (event as any).message.content;
                }
            }
            
            if (summary) {
                // Create compaction entry
                const lastMessageId = messages[messages.length - 1].id || 
                                    (messages[messages.length - 1] as any).message_id;
                
                const compaction: TopicCompaction = {
                    compacted_messages: messages.length,
                    compacted_tokens: compactedTokens,
                    compact_last_id: lastMessageId,
                    summary: summary
                };
                
                // Add to compaction map
                const existing = this.topicCompaction.get(tagName) || [];
                existing.push(compaction);
                this.topicCompaction.set(tagName, existing);
            }
        } catch (error) {
            console.error(`[MetaMemory] Error creating compaction for topic ${tagName}:`, error);
        }
    }

    /**
     * Compact messages by replacing with summaries
     */
    compact(messages: ResponseInput): ResponseInput {
        const compactedMessages: ResponseInput = [];
        const processedMessageIds = new Set<string>();
        
        for (const msg of messages) {
            const msgId = msg.id || (msg as any).message_id;
            
            // Skip if already processed
            if (msgId && processedMessageIds.has(msgId)) continue;
            
            // Check if this message should be compacted
            const metadata = msgId ? this.taggedMessages.get(msgId) : null;
            let shouldCompact = false;
            let compactionToUse: TopicCompaction | null = null;
            let compactionTag: string | null = null;
            
            if (metadata && metadata.topic_tags.length > 0) {
                // Check each tag for compaction
                for (const tag of metadata.topic_tags) {
                    const tagMeta = this.topicTags.get(tag);
                    const targetCompaction = tagMeta?.target_compaction_percent || 0;
                    
                    if (targetCompaction > 0) {
                        // Find the best compaction for this tag
                        const compactions = this.topicCompaction.get(tag) || [];
                        
                        for (const compaction of compactions) {
                            // Check if this message is included in the compaction
                            const compactedIds = this.getCompactedMessageIds(compaction.compact_last_id, messages);
                            
                            if (msgId && compactedIds.has(msgId)) {
                                // Check if compaction percentage is appropriate
                                const totalTokens = this.calculateTopicTokens(tag);
                                const compactionPercent = (compaction.compacted_tokens / totalTokens) * 100;
                                
                                if (compactionPercent <= targetCompaction + 10) {
                                    shouldCompact = true;
                                    compactionToUse = compaction;
                                    compactionTag = tag;
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (shouldCompact) break;
                }
            }
            
            if (shouldCompact && compactionToUse && compactionTag) {
                // Add all messages that are part of this compaction to processed set
                const compactedIds = this.getCompactedMessageIds(compactionToUse.compact_last_id, messages);
                compactedIds.forEach(id => processedMessageIds.add(id));
                
                // Add summary message
                const summaryMessage: ResponseInputItem = {
                    type: 'message',
                    role: 'developer' as any,
                    content: `[Compacted summary for topic "${compactionTag}"]: ${compactionToUse.summary}`,
                    id: uuidv4()
                };
                compactedMessages.push(summaryMessage);
            } else {
                // Keep original message
                compactedMessages.push(msg);
                if (msgId) processedMessageIds.add(msgId);
            }
        }
        
        return compactedMessages;
    }

    /**
     * Get all message IDs up to and including the specified last ID
     */
    private getCompactedMessageIds(lastId: string, messages: ResponseInput): Set<string> {
        const ids = new Set<string>();
        
        for (const msg of messages) {
            const msgId = msg.id || (msg as any).message_id;
            if (msgId) {
                ids.add(msgId);
                if (msgId === lastId) break;
            }
        }
        
        return ids;
    }

    /**
     * Calculate total tokens for a topic
     */
    private calculateTopicTokens(tagName: string): number {
        // This is an approximation based on summaries since we don't have full messages here
        // In production, you'd want to cache the actual token counts
        const messages = this.getMessagesByTopic(tagName);
        // Use summary length as a rough approximation when we don't have the full messages
        return messages.reduce((sum, msg) => {
            return sum + Math.ceil((msg.summary?.length || 0) / 4);
        }, 0);
    }
    
    /**
     * Handle merged topics by updating compaction data
     */
    private async handleMergedTopics(
        mergedTopics: Array<{
            source_tags: string[];
            merged_tag: string;
            type: string;
            description: string;
            merge_reason: string;
            messages_to_retag: string[];
        }>
    ): Promise<void> {
        for (const merge of mergedTopics) {
            // Merge compaction data from source topics to the merged topic
            const mergedCompactions: TopicCompaction[] = [];
            
            // Collect all compactions from source topics
            for (const sourceTag of merge.source_tags) {
                const sourceCompactions = this.topicCompaction.get(sourceTag);
                if (sourceCompactions) {
                    mergedCompactions.push(...sourceCompactions);
                }
                // Remove compaction data for the source topic
                this.topicCompaction.delete(sourceTag);
            }
            
            // If the merged topic already has compactions, preserve them
            const existingMergedCompactions = this.topicCompaction.get(merge.merged_tag);
            if (existingMergedCompactions) {
                mergedCompactions.push(...existingMergedCompactions);
            }
            
            // Sort compactions by the last message ID to maintain order
            // Note: In a real implementation, you'd want to sort by actual message order
            if (mergedCompactions.length > 0) {
                this.topicCompaction.set(merge.merged_tag, mergedCompactions);
            }
            
            console.log(`[MetaMemory] Merged topics ${merge.source_tags.join(', ')} into ${merge.merged_tag}. Reason: ${merge.merge_reason}`);
            console.log(`[MetaMemory] Updated ${merge.messages_to_retag.length} messages with new topic.`);
        }
    }
}

export type { MetamemoryState } from './types/index.js';