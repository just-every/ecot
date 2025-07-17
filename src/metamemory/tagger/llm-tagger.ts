import { MessageMetadata, TopicTagMetadata } from '../types/index.js';
import type { Agent, AgentDefinition, ResponseJSONSchema, ResponseInput } from '@just-every/ensemble';
import { ensembleRequest, truncateLargeValues } from '@just-every/ensemble';

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
                            description: `A 2-10 word summary of the message. Focus on the outcome and try to provide the key points of the message so it does not need to be read fully to understand what happened. Avoid generic summaries that do not convey specific information about the message content.

For example, say you a summarize a tool result \'{"query": "latest breakthroughs in quantum computing", "results":[{"title": "IBM Unveils 1000-Qubit Quantum Processor"}]}\', a bad summary would be "Web search results on quantum advances". A good summary would be "Found that IBM unveiled a 1000-qubit quantum processor".

Use the following style for each type of message:
- thinking: Present tense. Use words like, thinking, exploring, understanding etc... e.g. "Thinking about why API requests fail with 400 errors."
- function_call: Past tense. Convey an action was performed, e.g. "Searched for latest breakthroughs in quantum computing."
- function_call_output: Past tense. Convey action completed. e.g. "Found that IBM unveiled a 1000-qubit quantum processor." NB: focus on the outcome (what was found, result of action), not the process.
- function_call_with_output: Past tense. This combines a function call with its result. Focus on what was done AND what was found. e.g. "Searched quantum computing, found IBM's 1000-qubit processor."
- message: Past tense.
-- If role is user, system or developer, mention them in the summary e.g. "User asked for latest breakthroughs in quantum computing."
-- If role is assistant, this will be the AI explaining its reasoning or actions. Don't use the word Assistant, just describe give a straight summary e.g. "Explained why API requests fail with 400 errors."`
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
            },
            merge_topic_tags: {
                type: 'array',
                description: 'Suggested topic merges when one topic is a subset of another or very similar',
                items: {
                    type: 'object',
                    properties: {
                        source_tags: {
                            type: 'array',
                            description: 'The topic tags to merge (usually 2 or more)',
                            items: {
                                type: 'string',
                                description: 'Topic tag to merge'
                            },
                            minItems: 2
                        },
                        merged_tag: {
                            type: 'string',
                            description: 'The resulting merged topic tag name'
                        },
                        type: {
                            type: 'string',
                            description: 'Type for the merged topic',
                            enum: ['core', 'active', 'idle', 'archived', 'ephemeral']
                        },
                        description: {
                            type: 'string',
                            description: 'Description for the merged topic'
                        },
                        merge_reason: {
                            type: 'string',
                            description: 'Brief explanation of why these topics should be merged'
                        }
                    },
                    required: ['source_tags', 'merged_tag', 'type', 'description', 'merge_reason'],
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
        mergedTopics?: Array<{
            source_tags: string[];
            merged_tag: string;
            type: string;
            description: string;
            merge_reason: string;
            messages_to_retag: string[];
        }>;
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

Message Topic Tags:
- Be Consistent: Use the same topic tag for the same underlying concept (e.g., use api_integration_research if it exists, and don't create a new researching_apis).
- Be Granular: Identify distinct tasks, goals, or conversational themes. Good tags are specific, like database_schema_design or user_feedback_analysis_mar2025. Bad tags are generic, like chat or work.
- Be Minimal: Use the fewest tags necessary. Avoid over-tagging. Remove redundant tags from past messages.

Message Summaries:
For each message, create a 2-10 word summary that captures its essence. Use shorter summaries for simple messages.
Use the following style for each type of message:
- thinking: Present tense. Use words like, thinking, exploring, understanding etc... e.g. "Thinking about why API requests fail with 400 errors."
- function_call: Past tense. Convey an action was performed, e.g. "Searched for latest breakthroughs in quantum computing."
- function_call_output: Past tense. Convey action completed. e.g. "Found that IBM unveiled a 1000-qubit quantum processor." NB: focus on the outcome (what was found, result of action), not the process.
- function_call_with_output: Past tense. This combines a function call with its result. Focus on what was done AND what was found. e.g. "Searched quantum computing, found IBM's 1000-qubit processor."
- message: Past tense.
-- If role is user, system or developer, mention them in the summary e.g. "User asked for latest breakthroughs in quantum computing."
-- If role is assistant, this will be the AI explaining its reasoning or actions. Don't use the word Assistant, just describe give a straight summary e.g. "Explained why API requests fail with 400 errors."

Clarify Topics:
- For new topics, provide a brief description of what the CURRENT type of the topic is.
- Include a 1 sentence description of the topic to help future AI librarians include similar messages in the same topic tag.

Topic Merging:
- Detect when topics are subsets of each other or highly similar (e.g., "api_design" and "api_implementation" might be merged into "api_development").
- When you notice that all messages tagged with one topic are also tagged with another topic, suggest merging them.
- Suggest topic merges ONLY when you see recent messages with either of the tags to be merged.
- You don't need to manually retag messages when suggesting a merge - the system will automatically handle retagging all messages from the source topics to the merged topic.
- When suggesting a merge, provide a clear reason explaining the relationship between the topics.`,
        };

        // First, create a map to find function_call_outputs by their corresponding function_call IDs
        const functionCallOutputMap = new Map<string, any>();
        for (const message of messages) {
            if (message.type === 'function_call_output' && message.function_call_id) {
                functionCallOutputMap.set(message.function_call_id, message);
            }
        }

        // Prepare messages with existing tags
        const messagesWithTags: any[] = [];
        const newMessagesToTag: any[] = [];
        const processedMessageIds = new Set<string>();

        for (const message of messages) {
            const messageId = message.id || message.message_id;
            
            // Skip if already processed (e.g., as part of a function_call combo)
            if (processedMessageIds.has(messageId)) {
                continue;
            }

            // If this is a function_call, check for corresponding output
            if (message.type === 'function_call' && messageId) {
                const output = functionCallOutputMap.get(messageId);
                if (output) {
                    // Mark both as processed
                    processedMessageIds.add(messageId);
                    const outputId = output.id || output.message_id;
                    if (outputId) processedMessageIds.add(outputId);

                    // Create combined message for tagging
                    const combinedMessage = {
                        ...output, // Use output as base (it has the result)
                        function_call: message.function_call, // Include the function call details
                        combined_from_function_call: true,
                        original_function_call_id: messageId
                    };

                    const existingTag = existingTaggedMessages.get(outputId);
                    if (existingTag) {
                        messagesWithTags.push({
                            ...combinedMessage,
                            existing_tags: existingTag.topic_tags,
                            existing_summary: existingTag.summary
                        });
                    } else {
                        newMessagesToTag.push(combinedMessage);
                    }
                    continue;
                }
            }

            // Regular message processing
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
            
            processedMessageIds.add(messageId);
        }

        const requestMessages: ResponseInput = [];

        // Format existing topics
        let formattedTopics = 'Existing Topics in the System (can be updated):\n\n';
        if (existingTopicTags.size > 0) {
            for (const [topicTag, metadata] of existingTopicTags) {
                formattedTopics += `Topic Tag: ${topicTag}\n`;
                formattedTopics += `Topic Type: ${metadata.type}\n`;
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
                
                // Handle combined function_call + output messages
                if (msg.combined_from_function_call) {
                    formattedMessages += `Message Type: function_call_with_output\n`;
                } else {
                    formattedMessages += `Message Type: ${msg.type}\n`;
                }
                
                formattedMessages += `Current Tags: ${msg.existing_tags.join(', ')}\n`;
                formattedMessages += `Current Summary: ${msg.existing_summary}\n`;
                
                // Format the message, removing the original_function_call_id from display
                const msgCopy = { ...msg };
                delete msgCopy.original_function_call_id;
                delete msgCopy.combined_from_function_call;
                formattedMessages += `Full Message:\n${JSON.stringify(truncateLargeValues(msgCopy), null, 2)}\n\n---\n\n`;
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
                
                // Handle combined function_call + output messages
                if (msg.combined_from_function_call) {
                    formattedNewMessages += `Message Type: function_call_with_output\n`;
                    formattedNewMessages += `Note: This combines a function call with its output result.\n`;
                } else {
                    formattedNewMessages += `Message Type: ${msg.type}\n`;
                }
                
                // Format the message, removing the original_function_call_id from display
                const msgCopy = { ...msg };
                delete msgCopy.original_function_call_id;
                delete msgCopy.combined_from_function_call;
                formattedNewMessages += `Full Message:\n${JSON.stringify(truncateLargeValues(msgCopy), null, 2)}\n\n---\n\n`;
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
            // Extract JSON from response content (might contain extra text)
            let jsonContent = responseContent.trim();
            
            // Try to find JSON object boundaries
            const jsonStart = jsonContent.indexOf('{');
            const jsonEnd = jsonContent.lastIndexOf('}');
            
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
            } else {
                // If no valid JSON structure found, skip processing
                console.warn('[MetaMemory] No valid JSON structure found in response:', responseContent);
                return {
                    topicTags: existingTopicTags,
                    taggedMessages: existingTaggedMessages,
                    newTopicCount: 0,
                    updatedTopicCount: 0,
                    newMessageCount: 0,
                    updatedMessageCount: 0,
                    mergedTopics: []
                };
            }
            
            // Validate that we have a reasonable JSON structure
            if (jsonContent.length < 2) {
                console.warn('[MetaMemory] JSON content too short:', jsonContent);
                return {
                    topicTags: existingTopicTags,
                    taggedMessages: existingTaggedMessages,
                    newTopicCount: 0,
                    updatedTopicCount: 0,
                    newMessageCount: 0,
                    updatedMessageCount: 0,
                    mergedTopics: []
                };
            }
            
            // Parse the JSON response (should be clean JSON thanks to schema)
            const parsed = JSON.parse(jsonContent);

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

            // Process topic merges
            let mergedTopics: Array<{
                source_tags: string[];
                merged_tag: string;
                type: string;
                description: string;
                merge_reason: string;
                messages_to_retag: string[];
            }> | undefined;

            if (parsed.merge_topic_tags && Array.isArray(parsed.merge_topic_tags)) {
                mergedTopics = [];
                
                for (const merge of parsed.merge_topic_tags) {
                    if (merge.source_tags && Array.isArray(merge.source_tags) && 
                        merge.merged_tag && merge.type && merge.description && merge.merge_reason) {
                        
                        // Normalize all tags
                        const normalizedSourceTags = merge.source_tags.map((tag: string) => 
                            this.normalizeTopicTag(tag)
                        );
                        const normalizedMergedTag = this.normalizeTopicTag(merge.merged_tag);
                        
                        // Find all messages that need to be retagged
                        const messagesToRetag: string[] = [];
                        for (const [msgId, msgMeta] of taggedMessages) {
                            const hasSourceTag = msgMeta.topic_tags.some(tag => 
                                normalizedSourceTags.includes(tag)
                            );
                            if (hasSourceTag) {
                                messagesToRetag.push(msgId);
                                
                                // Update the message tags
                                const newTags = msgMeta.topic_tags
                                    .filter(tag => !normalizedSourceTags.includes(tag))
                                    .concat(normalizedMergedTag);
                                
                                // Remove duplicates
                                msgMeta.topic_tags = [...new Set(newTags)];
                                msgMeta.last_update = Date.now();
                            }
                        }
                        
                        // Add the merged topic to topicTags if not already present
                        if (!topicTags.has(normalizedMergedTag)) {
                            topicTags.set(normalizedMergedTag, {
                                topic_tag: normalizedMergedTag,
                                type: merge.type,
                                description: merge.description,
                                last_update: Date.now()
                            });
                            newTopicCount++;
                        }
                        
                        // Remove the source topics from topicTags
                        for (const sourceTag of normalizedSourceTags) {
                            topicTags.delete(sourceTag);
                        }
                        
                        mergedTopics.push({
                            source_tags: normalizedSourceTags,
                            merged_tag: normalizedMergedTag,
                            type: merge.type,
                            description: merge.description,
                            merge_reason: merge.merge_reason,
                            messages_to_retag: messagesToRetag
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
                updatedMessageCount,
                mergedTopics
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