import { Message, TaggedMessage } from '../types/index.js';
import type { TaggerLLM } from './index.js';
import type { Agent } from '@just-every/ensemble';

const TAGGER_PROMPT = `You are an expert AI librarian and conversation analyst. Your task is to analyze a list of recent messages from a conversation and assign one or more topic tags to each message.

Guidelines:
- Be Consistent: Use the same topic tag for the same underlying concept (e.g., use api_integration_research not researching_apis).
- Be Granular: Identify distinct tasks, goals, or conversational themes. Good tags are specific, like database_schema_design or user_feedback_analysis_mar2025. Bad tags are generic, like chat or work.
- Identify Core Instructions: If a message contains a foundational user instruction, a core goal, or a constraint that must always be remembered, tag it with core.
- Identify Ephemeral Chatter: If a message is conversational filler, a simple greeting, or a trivial, state-less query (like "what's the time?"), tag it with ephemeral.
- Identify Relationships: When you identify topics that are sub-topics or related to existing topics, note these relationships.

Output Format:
Return a JSON object with two arrays:
1. "messages": For each message, an object containing the message's unique ID and a list of topic tags.
2. "relationships": Optional array of topic relationships in format {"parent": "topic1", "child": "topic2"}

Example Output:
{
  "messages": [
    {
      "message_id": "msg_701",
      "topics": ["frontend_framework_debate", "react_vs_vue_pros_cons"]
    },
    {
      "message_id": "msg_702",
      "topics": ["core"]
    },
    {
      "message_id": "msg_703",
      "topics": ["ephemeral"]
    }
  ],
  "relationships": [
    {"parent": "frontend_framework_debate", "child": "react_vs_vue_pros_cons"}
  ]
}

Existing Topics in the System:
{{existing_topics}}

Conversation to Analyze:
{{messages_json}}`;

export interface TopicRelationship {
  parent: string;
  child: string;
}

export class LLMTagger implements TaggerLLM {
  private agent: Agent;
  private topicRelationships: TopicRelationship[] = [];
  
  constructor(agent: Agent) {
    this.agent = agent;
  }
  
  async tag(messages: Message[], existingTopics: string[]): Promise<TaggedMessage[]> {
    // Format messages for the prompt
    const messagesJson = messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content.slice(0, 500) // Truncate long messages
    }));
    
    // Build the prompt
    const prompt = TAGGER_PROMPT
      .replace('{{existing_topics}}', existingTopics.join(', ') || 'None')
      .replace('{{messages_json}}', JSON.stringify(messagesJson, null, 2));
    
    // Create a new agent for tagging based on the original
    const taggerAgent = {
      ...this.agent,
      name: 'MetaMemory-Tagger',
      modelClass: 'standard' // Use a fast model for tagging
    };
    
    // Get the tagging result using the agent's generate method
    const response = await (this.agent as any).generate.call(taggerAgent, [{
      role: 'user',
      content: prompt
    }]);
    
    try {
      // Parse the JSON response
      const parsed = JSON.parse(response.content as string);
      
      // Validate and transform the response
      const taggedMessages: TaggedMessage[] = [];
      
      // Handle new format with messages and relationships
      if (parsed.messages && Array.isArray(parsed.messages)) {
        for (const item of parsed.messages) {
          if (item.message_id && Array.isArray(item.topics)) {
            taggedMessages.push({
              messageId: item.message_id,
              topics: item.topics.filter((t: any) => typeof t === 'string')
            });
          }
        }
        
        // Store relationships if provided
        if (parsed.relationships && Array.isArray(parsed.relationships)) {
          for (const rel of parsed.relationships) {
            if (rel.parent && rel.child) {
              this.topicRelationships.push({
                parent: rel.parent,
                child: rel.child
              });
            }
          }
        }
      } else if (Array.isArray(parsed)) {
        // Handle old format for backward compatibility
        for (const item of parsed) {
          if (item.message_id && Array.isArray(item.topics)) {
            taggedMessages.push({
              messageId: item.message_id,
              topics: item.topics.filter((t: any) => typeof t === 'string')
            });
          }
        }
      }
      
      return taggedMessages;
    } catch (error) {
      console.error('[MetaMemory] Failed to parse tagger response:', error);
      // Return empty tags on error
      return messages.map(msg => ({
        messageId: msg.id,
        topics: []
      }));
    }
  }
  
  /**
   * Get all discovered topic relationships
   */
  getTopicRelationships(): TopicRelationship[] {
    return [...this.topicRelationships];
  }
  
  /**
   * Clear stored topic relationships
   */
  clearRelationships(): void {
    this.topicRelationships = [];
  }
}