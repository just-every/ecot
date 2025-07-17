export type TopicState = 'core' | 'active' | 'idle' | 'archived' | 'ephemeral';

export interface VectorEmbeddings {
    [topicName: string]: {
        summary: string;
        embedding: number[];
    };
}

export interface MessageMetadata {
    message_id: string;
    topic_tags: string[];
    summary: string;
    last_update: number; // Timestamp of last update
}

export interface TopicTagMetadata {
    topic_tag: string;
    type: 'core' | 'active' | 'idle' | 'archived' | 'ephemeral';
    description: string;
    last_update: number; // Timestamp of last update
    target_compaction_percent?: number;
}

export interface MetamemoryState {
    topicTags: Map<string, TopicTagMetadata>;
    taggedMessages: Map<string, MessageMetadata>;
    topicCompaction?: Map<string, TopicCompaction[]>;
    lastProcessedIndex: number;
}

// JSON-serializable version of MetamemoryState for events
export interface SerializedMetamemoryState {
    topicTags: { [key: string]: TopicTagMetadata };
    taggedMessages: { [key: string]: MessageMetadata };
    topicCompaction?: { [key: string]: TopicCompaction[] };
    lastProcessedIndex: number;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: number;
    metadata?: Record<string, any>;
}

export interface TopicThread {
    name: string;
    state: TopicState;
    messages: Message[];
    summary: string;
    lastActiveTimestamp: number;
    createdAt: number;
    tokenCount: number;
    relationships?: string[]; // Related topic names
}

export interface TopicThreadStore {
    [topicName: string]: TopicThread;
}

export interface MetaMemoryConfig {
    slidingWindowSize: number;
    processingThreshold: number;
}

export interface TopicCompaction {
    compacted_messages: number; // The number of messages compacted in the summary
    compacted_tokens: number; // The number of tokens compacted in the summary (i.e. tokens in compacted messages)
    compact_last_id: string; // The id of the last message compacted
    summary: string; // The compacted summary of the messages
}

export interface CompactionLevel {
    level: 'light' | 'heavy' | 'archival';
    maxTokens: number;
    preserveLatestMessages: number;
}

export interface SummaryRequest {
    topicName: string;
    threadState: TopicState;
    reason: string;
    messages: Message[];
    level: CompactionLevel;
}

export interface ContextAssemblyOptions {
    maxTokens: number;
    includeIdleSummaries: boolean;
    includeArchivedSearch: boolean;
    recentMessageCount: number;
}

export interface VectorSearchResult {
    topicName: string;
    summary: string;
    relevanceScore: number;
}