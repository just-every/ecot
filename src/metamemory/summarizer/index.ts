import { TopicThread, CompactionLevel, Message } from '../types/index.js';
import type { SummarizerInterface } from '../compactor/index.js';
import type { Agent } from '@just-every/ensemble';

const SUMMARIZATION_PROMPTS = {
  light: `You are an expert AI archivist. Your task is to summarize a conversational thread. Your summary should be dense with facts, decisions, key findings, and open questions.

Thread Topic: {{topic_name}}
Current State: Active (Light Compaction)
Reason for Compaction: Routine compaction of an active thread

INSTRUCTIONS:
- You are summarizing the OLDEST part of an ongoing conversation.
- Focus on retaining specific facts, data points, and decisions.
- Conclude with a "Current Status" section that BRIEFLY sets the stage for the more recent, un-summarized messages that will follow.

Conversation to Summarize:
{{messages}}

Your Summary:`,

  heavy: `You are an expert AI archivist. Your task is to summarize a conversational thread. Your summary should be dense with facts, decisions, key findings, and open questions.

Thread Topic: {{topic_name}}
Current State: Idle (Heavy Compaction)
Reason for Compaction: Thread has been inactive and is being moved to idle state

INSTRUCTIONS:
- You are summarizing a thread that is not currently in focus.
- The goal is to create a concise brief that can quickly bring the main LLM up to speed if it returns to this topic.
- Focus on: What was the goal? What was accomplished? What were the key learnings or blocking issues? What is the next logical step if this topic is resumed?

Conversation to Summarize:
{{messages}}

Your Summary:`,

  archival: `You are an expert AI archivist. Your task is to summarize a conversational thread. Your summary should be dense with facts, decisions, key findings, and open questions.

Thread Topic: {{topic_name}}
Current State: Archived (Archival Summary)
Reason for Compaction: Creating final record for long-term storage

INSTRUCTIONS:
- You are creating a final, definitive record of a completed or abandoned topic.
- This summary is for long-term memory. It should be a comprehensive overview.
- Include the initial goal, the process followed, the final outcome, and any key data or code snippets that were produced.

Conversation to Summarize:
{{messages}}

Your Summary:`
};

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
    const summarizerAgent = {
      ...this.agent,
      name: 'MetaMemory-Summarizer',
      modelClass: 'standard' // Use standard model for summarization
    };
    
    // Get the summary using the agent's generate method
    const response = await (this.agent as any).generate.call(summarizerAgent, [{
      role: 'user',
      content: prompt
    }]);
    
    // Extract and clean the summary
    const summary = this.cleanSummary(response.content as string, level.maxTokens);
    
    return summary;
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