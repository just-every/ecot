import { MessageMetadata, TopicTagMetadata } from '../types/index.js';
import type { Agent, AgentDefinition, ResponseJSONSchema, ResponseInput } from '@just-every/ensemble';
import { ensembleRequest } from '@just-every/ensemble';
import { truncateLargeValues } from '../../utils/format.js';

// JSON Schema for the tagger response
const TAGGER_RESPONSE_SCHEMA: ResponseJSONSchema = {
    name: 'metamemory_tagger_response',
    type: 'json_schema',
    description: 'Topic tagging for conversation messages',
    strict: true,
    schema: {
        type: 'object',
        properties: {
            messages: {
                type: 'array',
                description: 'Array of messages with their assigned topic tags. Please tag every message that is not already tagged or that you believe needs a better topic or summary. You do not need to tag messages that already have a topic and summary that you believe is sufficient.',
                items: {
                    type: 'object',
                    properties: {
                        message_id: {
                            type: 'string',
                            description: 'The unique ID of the message. This must match the ID provided in the JSON.'
                        },
                        topic_tags: {
                            type: 'array',
                            description: 'List of topic tags assigned to this message. You can use existing topic tags or create new ones. A single message can have multiple topics, but most messages only have 1 topic. You should only add ONE topic unless really necessary.',
                            items: {
                                type: 'string',
                                description: 'A topic tag (e.g., "database_design", "latest_ai_news_request" or "pizza_icon_designs" are good tag formats). Please only use lowercase alphanumeric characters and underscores. Do not use spaces or special characters.'
                            }
                        },
                        summary: {
                            type: 'string',
                            description: 'A 2-10 word summary of the message. Used past tense and focus on the outcome. For example, say you a summarize a tool result \'{"query": "latest breakthroughs in quantum computing", "results":[{"title": "IBM Unveils 1000-Qubit Quantum Processor"}]}\', a bad summary would be "Web search results on quantum advances". A good summary would be "Found that IBM unveiled a 1000-qubit quantum processor".'
                        }
                    },
                    required: ['message_id', 'topic_tags', 'summary'],
                    additionalProperties: false
                }
            },
            topic_tag_types: {
                type: 'array',
                description: 'For any NEW topics created, please describe them here. You can also update any existing topics here if you believe they need a better type or description. You do not need to include existing topics that you believe are sufficient.',
                items: {
                    type: 'object',
                    properties: {
                        topic_tag: {
                            type: 'string',
                            description: 'The unique topic tag name (e.g., "database_design"). Please only use lowercase alphanumeric characters and underscores. Do not use spaces or special characters.'
                        },
                        type: {
                            type: 'string',
                            description: `Which type CURRENTLY best describes this topic? Choose from the following types:

Core: Never compacted. These are foundational instructions, core goals, and immutable principles for the agent. They are always in the context window.

Active: Lightly compacted. These are topics the agent is currently working on. The full recent history of these threads should be available, with older parts being gently summarized to preserve key facts while saving space.

Idle: Heavily compacted. These are topics that were recently active but are now on the back-burner. They are summarized down to their essential conclusions, learnings, and current status. They are not in the active context but can be quickly re-expanded if the conversation returns to them.

Archived: Archival summary. These are completed or abandoned topics. They are summarized into a final, dense record. The raw messages can be offloaded entirely, with the summary indexed for semantic search. This is the agent's "long-term memory."

Ephemeral: Discarded after a short time. This is for conversational filler or trivial, one-off tool calls (e.g., checking the current time). These can be ignored by the summarizer and eventually dropped.`,
                            enum: ['core', 'active', 'idle', 'archived', 'ephemeral'],
                        },
                        description: {
                            type: 'string',
                            description: 'What types of messages should be tagged with this topic? Only 1 sentence please.'
                        }
                    },
                    required: ['topic_tag', 'type', 'description'],
                    additionalProperties: false
                }
            }
        },
        required: ['messages', 'topic_tag_types'],
        additionalProperties: false
    }
};

export class LLMTagger {
    /**
     * Normalize topic tag to lowercase with underscores
     */
    private static normalizeTopicTag(tag: string): string {
        return tag
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
    }

    /**
     * Tag messages with topics and summaries
     */
    static async tag(
        messages: any[],
        existingTopicTags: Map<string, TopicTagMetadata>,
        existingTaggedMessages: Map<string, MessageMetadata>,
        parent: Agent
    ): Promise<{
        topicTags: Map<string, TopicTagMetadata>;
        taggedMessages: Map<string, MessageMetadata>;
        newTopicCount: number;
        updatedTopicCount: number;
        newMessageCount: number;
        updatedMessageCount: number;
    }> {

        // Create a new agent for tagging based on the original
        const agent: AgentDefinition = {
            name: 'MetaMemoryTagger',
            modelClass: 'summary',
            tags: ['background', 'memory'],
            modelSettings: {
                json_schema: TAGGER_RESPONSE_SCHEMA,
            },
            parent_id: parent.agent_id,
            instructions: `You are an expert AI librarian and conversation analyst. Your task is to analyze a list of recent messages from a conversation or task performed by an AI and assign one or more topic tags to each message. You must also provide a brief 2-5 word summary of each message. Use the existing topics provided, and create new ones as needed. Your goal is to help organize and summarize the conversation effectively, so it can be compacted down and to ensure the most important information is retained as time passes.

Guidelines:
- Be Consistent: Use the same topic tag for the same underlying concept (e.g., use api_integration_research if it exists, and don't create a new researching_apis).
- Be Granular: Identify distinct tasks, goals, or conversational themes. Good tags are specific, like database_schema_design or user_feedback_analysis_mar2025. Bad tags are generic, like chat or work.
- Create Summaries: For each message, create a 2-10 word summary that captures its essence. Use shorter summaries for simple messages.

Clarify Topics:
- For new topics, provide a brief description of what the CURRENT type of the topic is.
- Include a 1 sentence description of the topic to help future AI librarians include similar messages in the same topic tag.`,
        };

        // Prepare messages with existing tags
        const messagesWithTags: any[] = [];
        const newMessagesToTag: any[] = [];

        for (const message of messages) {
            const messageId = message.id || message.message_id;
            const existingTag = existingTaggedMessages.get(messageId);

            if (existingTag) {
                // Include full message with its existing tags
                messagesWithTags.push({
                    ...message,
                    existing_tags: existingTag.topic_tags,
                    existing_summary: existingTag.summary
                });
            } else {
                // Message has no tags yet
                newMessagesToTag.push(message);
            }
        }

        const requestMessages: ResponseInput = [];

        // Format existing topics
        let formattedTopics = 'Existing Topics in the System (can be updated):\n\n';
        if (existingTopicTags.size > 0) {
            for (const [topicTag, metadata] of existingTopicTags) {
                formattedTopics += `Topic Tag: ${topicTag}\n`;
                formattedTopics += `Type: ${metadata.type}\n`;
                formattedTopics += `Description: ${metadata.description}\n\n---\n\n`;
            }
        } else {
            formattedTopics += 'None - please create a new topic if needed\n';
        }

        requestMessages.push({
            type: 'message',
            role: 'user',
            content: formattedTopics.trim(),
        });

        if (messagesWithTags.length > 0) {
            let formattedMessages = 'Messages with Existing Tags (can be updated):\n\n';
            for (const msg of messagesWithTags) {
                const messageId = msg.id || msg.message_id;
                formattedMessages += `Message ID: ${messageId}\n`;
                formattedMessages += `Current Tags: ${msg.existing_tags.join(', ')}\n`;
                formattedMessages += `Current Summary: ${msg.existing_summary}\n`;
                formattedMessages += `Full Message:\n${JSON.stringify(truncateLargeValues(msg), null, 2)}\n\n---\n\n`;
            }

            requestMessages.push({
                type: 'message',
                role: 'user',
                content: formattedMessages.trim(),
            });
        }

        if (newMessagesToTag.length > 0) {
            let formattedNewMessages = 'New Messages to Tag:\n\n';
            for (const msg of newMessagesToTag) {
                const messageId = msg.id || msg.message_id;
                formattedNewMessages += `Message ID: ${messageId}\n`;
                formattedNewMessages += `Full Message:\n${JSON.stringify(truncateLargeValues(msg), null, 2)}\n\n---\n\n`;
            }

            requestMessages.push({
                type: 'message',
                role: 'user',
                content: formattedNewMessages.trim(),
            });
        }

        let responseContent = '';
        let isComplete = false;
        for await (const event of ensembleRequest(requestMessages, agent)) {
            if (event.type === 'message_delta' && 'content' in event && event.content && !isComplete) {
                responseContent += event.content;
            }
            if (event.type === 'message_complete' && 'content' in event && event.content) {
                responseContent = event.content;
                isComplete = true;
            }
        }

        try {
            // Parse the JSON response (should be clean JSON thanks to schema)
            const parsed = JSON.parse(responseContent);

            // Create result maps
            const topicTags = new Map<string, TopicTagMetadata>(existingTopicTags);
            const taggedMessages = new Map<string, MessageMetadata>(existingTaggedMessages);

            // Initialize counters
            let newTopicCount = 0;
            let updatedTopicCount = 0;
            let newMessageCount = 0;
            let updatedMessageCount = 0;

            // Process topic tag types
            if (parsed.topic_tag_types && Array.isArray(parsed.topic_tag_types)) {
                for (const topicType of parsed.topic_tag_types) {
                    if (topicType.topic_tag && topicType.type && topicType.description) {
                        const normalizedTag = this.normalizeTopicTag(topicType.topic_tag);
                        const isNewTopic = !existingTopicTags.has(normalizedTag);

                        if (isNewTopic) {
                            newTopicCount++;
                        } else {
                            updatedTopicCount++;
                        }

                        topicTags.set(normalizedTag, {
                            topic_tag: normalizedTag,
                            type: topicType.type,
                            description: topicType.description,
                            last_update: Date.now()
                        });
                    }
                }
            }

            // Process messages
            if (parsed.messages && Array.isArray(parsed.messages)) {
                for (const item of parsed.messages) {
                    if (item.message_id && Array.isArray(item.topic_tags) && item.summary) {
                        // Normalize all topic tags
                        const normalizedTags = item.topic_tags
                            .filter((t: any) => typeof t === 'string')
                            .map((t: string) => this.normalizeTopicTag(t));

                        const isNewMessage = !existingTaggedMessages.has(item.message_id);

                        if (isNewMessage) {
                            newMessageCount++;
                        } else {
                            updatedMessageCount++;
                        }

                        taggedMessages.set(item.message_id, {
                            message_id: item.message_id,
                            topic_tags: normalizedTags,
                            summary: item.summary,
                            last_update: Date.now()
                        });
                    }
                }
            }

            return {
                topicTags,
                taggedMessages,
                newTopicCount,
                updatedTopicCount,
                newMessageCount,
                updatedMessageCount
            };
        } catch (error) {
            console.error('[MetaMemory] Failed to parse tagger response:', error);
            console.error('[MetaMemory] Response was:', responseContent);
            // Return existing data unchanged on error
            return {
                topicTags: existingTopicTags,
                taggedMessages: existingTaggedMessages,
                newTopicCount: 0,
                updatedTopicCount: 0,
                newMessageCount: 0,
                updatedMessageCount: 0
            };
        }
    }
}