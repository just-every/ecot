import { TopicThread, CompactionLevel, Message } from '../types/index.js';
import type { Agent, ResponseJSONSchema } from '@just-every/ensemble';
import { ensembleRequest, cloneAgent } from '@just-every/ensemble';

export interface SummarizerInterface {
  summarize(
    thread: TopicThread,
    messagesToSummarize: number,
    level: CompactionLevel
  ): Promise<string>;
}

// JSON Schema for thread summary response
const THREAD_SUMMARY_SCHEMA: ResponseJSONSchema = {
  name: 'thread_summary_response',
  type: 'json_schema',
  description: 'Structured summary of a conversation thread',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'The main summary text of the thread'
      },
      key_points: {
        type: 'array',
        description: 'List of key points, decisions, or findings',
        items: {
          type: 'string'
        }
      },
      open_questions: {
        type: 'array',
        description: 'List of unresolved questions or issues',
        items: {
          type: 'string'
        }
      },
      next_steps: {
        type: 'string',
        description: 'Suggested next steps if this topic is resumed'
      },
      current_status: {
        type: 'string',
        description: 'Brief status of where the conversation left off'
      }
    },
    required: ['summary'],
    additionalProperties: false
  }
};

const SUMMARIZATION_PROMPTS = {
  light: `You are an expert AI archivist. Your task is to summarize a conversational thread. Your summary should be dense with facts, decisions, key findings, and open questions.

Thread Topic: {{topic_name}}
Current State: Active (Light Compaction)
Reason for Compaction: Routine compaction of an active thread

INSTRUCTIONS:
- You are summarizing the OLDEST part of an ongoing conversation.
- Focus on retaining specific facts, data points, and decisions.
- Provide key points as a list for easy reference.
- Note any open questions that remain unresolved.
- Include a "current_status" that BRIEFLY sets the stage for the more recent, un-summarized messages that will follow.

Conversation to Summarize:
{{messages}}`,

  heavy: `You are an expert AI archivist. Your task is to summarize a conversational thread. Your summary should be dense with facts, decisions, key findings, and open questions.

Thread Topic: {{topic_name}}
Current State: Idle (Heavy Compaction)
Reason for Compaction: Thread has been inactive and is being moved to idle state

INSTRUCTIONS:
- You are summarizing a thread that is not currently in focus.
- The goal is to create a concise brief that can quickly bring the main LLM up to speed if it returns to this topic.
- Focus on: What was the goal? What was accomplished? What were the key learnings or blocking issues?
- Include clear next_steps for if this topic is resumed.

Conversation to Summarize:
{{messages}}`,

  archival: `You are an expert AI archivist. Your task is to summarize a conversational thread. Your summary should be dense with facts, decisions, key findings, and open questions.

Thread Topic: {{topic_name}}
Current State: Archived (Archival Summary)
Reason for Compaction: Creating final record for long-term storage

INSTRUCTIONS:
- You are creating a final, definitive record of a completed or abandoned topic.
- This summary is for long-term memory. It should be a comprehensive overview.
- Include the initial goal, the process followed, the final outcome, and any key data or code snippets that were produced.
- If the topic was abandoned, note why in the next_steps field.

Conversation to Summarize:
{{messages}}`
};

export class ThreadSummarizer {
  async summarizeThread(thread: TopicThread): Promise<{
    threadId: string;
    title: string;
    summary: string;
    keyPoints: string[];
    tokenCount: number;
  }> {
    // Simple mock implementation for backward compatibility
    const summary = `Summary of thread ${thread.name}: ${thread.messages.length} messages`;
    return {
      threadId: thread.name,
      title: thread.name,
      summary,
      keyPoints: [],
      tokenCount: Math.ceil(summary.length / 4)
    };
  }
}

export class LLMSummarizer implements SummarizerInterface {
  private agent: Agent;
  
  constructor(agent: Agent) {
    this.agent = agent;
  }
  
  async summarize(
    thread: TopicThread,
    messagesToSummarize: number,
    level: CompactionLevel
  ): Promise<string> {
    // Get the messages to summarize
    const messages = thread.messages.slice(0, messagesToSummarize);
    
    if (messages.length === 0) {
      return '';
    }
    
    // Format messages for the prompt
    const formattedMessages = this.formatMessages(messages);
    
    // Get the appropriate prompt template
    const promptTemplate = SUMMARIZATION_PROMPTS[level.level];
    
    // Build the prompt
    const prompt = promptTemplate
      .replace('{{topic_name}}', thread.name)
      .replace('{{messages}}', formattedMessages);
    
    // Create a new agent for summarization based on the original
    const summarizerAgent = cloneAgent(this.agent);
    summarizerAgent.name = 'MetaMemory-Summarizer';
    summarizerAgent.modelClass = 'standard'; // Use standard model for summarization
    
    // Add JSON schema to the agent's model settings
    if (!summarizerAgent.modelSettings) {
      summarizerAgent.modelSettings = {};
    }
    summarizerAgent.modelSettings.json_schema = THREAD_SUMMARY_SCHEMA;
    
    // Get the summary using ensembleRequest
    let responseContent = '';
    const requestMessages = [{
      type: 'message' as const,
      role: 'user' as const,
      content: prompt,
      id: `summarizer_${Date.now()}`
    }];
    
    for await (const event of ensembleRequest(requestMessages, summarizerAgent)) {
      if (event.type === 'message_delta' && 'content' in event && event.content) {
        responseContent += event.content;
      }
    }
    
    try {
      // Parse the JSON response
      const parsed = JSON.parse(responseContent);
      
      // Build a formatted summary from the structured response
      let formattedSummary = parsed.summary || '';
      
      if (parsed.key_points && parsed.key_points.length > 0) {
        formattedSummary += '\n\nKey Points:\n' + parsed.key_points.map((p: string) => `• ${p}`).join('\n');
      }
      
      if (parsed.open_questions && parsed.open_questions.length > 0) {
        formattedSummary += '\n\nOpen Questions:\n' + parsed.open_questions.map((q: string) => `• ${q}`).join('\n');
      }
      
      if (parsed.next_steps) {
        formattedSummary += '\n\nNext Steps: ' + parsed.next_steps;
      }
      
      if (parsed.current_status) {
        formattedSummary += '\n\nCurrent Status: ' + parsed.current_status;
      }
      
      // Clean and truncate the summary
      return this.cleanSummary(formattedSummary, level.maxTokens);
    } catch (error) {
      console.error('[MetaMemory] Failed to parse summary response:', error);
      console.error('[MetaMemory] Response was:', responseContent);
      // Fall back to using the raw response
      return this.cleanSummary(responseContent, level.maxTokens);
    }
  }
  
  /**
   * Format messages for the summarization prompt
   */
  private formatMessages(messages: Message[]): string {
    return messages
      .map((msg, index) => {
        const timestamp = new Date(msg.timestamp).toISOString();
        return `[${index + 1}] ${msg.role.toUpperCase()} (${timestamp}):\n${msg.content}\n`;
      })
      .join('\n---\n\n');
  }
  
  /**
   * Clean and truncate the summary to fit token limits
   */
  private cleanSummary(summary: string, maxTokens: number): string {
    // Remove any markdown formatting that might interfere
    let cleaned = summary.trim();
    
    // Simple token estimation (4 chars per token)
    const estimatedTokens = Math.ceil(cleaned.length / 4);
    
    if (estimatedTokens > maxTokens) {
      // Truncate to fit token limit
      const maxChars = maxTokens * 4;
      cleaned = cleaned.substring(0, maxChars - 20) + '\n[Summary truncated]';
    }
    
    return cleaned;
  }
}