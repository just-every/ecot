/**
 * Task Engine - Simplified Version
 *
 * Task implementation for LLM orchestration.
 * Provides meta-cognition and thought delays on top of ensemble.
 * Model rotation is handled by ensemble automatically.
 */

import { taskState } from '../state/state.js';
import { runThoughtDelay, getThoughtDelay } from './thought_utils.js';
import { spawnMetaThought } from './meta_cognition.js';
import { 
    ensembleRequest,
    createToolFunction,
    cloneAgent,
    waitWhilePaused,
    type ToolFunction,
    type Agent,
    type ResponseInput,
    type ProviderStreamEvent
} from '@just-every/ensemble';

/**
 * Get Task control tools
 */
function getTaskTools(): ToolFunction[] {
    return [
        createToolFunction(
            (result: string ) => {
                console.log('[Task] Task completed:', result);
                // Return the result so it can be captured in the tool_done event
                return result;
            },
            'Report that the task has completed successfully',
            {
                result: {
                    type: 'string',
                    description: 'A few paragraphs describing the result. Be thorough and comprehensive.'
                }
            },
            undefined,
            'task_complete'
        ),
        
        createToolFunction(
            (error: string ) => {
                console.error('[Task] Task failed:', error);
                // Return the error so it can be captured in the tool_done event
                return error;
            },
            'Report that you were not able to complete the task',
            {
                error: {
                    type: 'string',
                    description: 'Describe the error that occurred in a few sentences'
                }
            },
            undefined,
            'task_fatal_error'
        )
    ];
}

/**
 * Run Mind with automatic everything
 * 
 * @param agent - The agent from ensemble
 * @param content - The task/prompt to execute
 * @returns AsyncGenerator that yields all ProviderStreamEvents
 * 
 * @example
 * ```typescript
 * import { Agent } from '@just-every/ensemble';
 * import { runTask } from '@just-every/task';
 * 
 * const agent = new Agent({ 
 *     name: 'MyAgent',
 *     modelClass: 'reasoning' 
 * });
 * 
 * for await (const event of runTask(agent, 'Analyze this code')) {
 *     console.log(event);
 * }
 * ```
 */
export async function* runTask(
    agent: Agent,
    content: string
): AsyncGenerator<ProviderStreamEvent> {
    // Basic validation
    if (!agent || typeof agent !== 'object') {
        throw new Error('Agent must be a valid Agent instance');
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
        throw new Error('Content must be a non-empty string');
    }
    const startTime = Date.now();
    
    // Build initial messages with tool guidance
    const toolGuidance = 'You must complete tasks by using the provided tools. When you have finished a task, you MUST call the task_complete tool with a comprehensive result. If you cannot complete the task, you MUST call the task_fatal_error tool with an explanation. Do not just provide a final answer without using these tools.';
    
    // Check if agent instructions already contain task_complete guidance
    const hasTaskCompleteGuidance = agent.instructions?.includes('task_complete');
    
    const messages: ResponseInput = [
        {
            type: 'message',
            role: 'system',
            content: agent.instructions 
                ? (hasTaskCompleteGuidance ? agent.instructions : `${agent.instructions}\n\n${toolGuidance}`)
                : toolGuidance
        },
        {
            type: 'message',
            role: 'user',
            content
        }
    ];

    // Add Task tools to the agent
    const taskTools = getTaskTools();
    
    // Clone agent to get AgentDefinition and add Task tools
    const agentDef = cloneAgent(agent);
    agentDef.tools = [...taskTools, ...(agent.tools || [])];

    // Track completion state
    let isComplete = false;
    
    try {
        console.log(`[Task] Starting execution for agent: ${agent.name}`);
        
        // Run the request loop
        let iteration = 0;
        
        while (!isComplete && iteration < 100) {
            iteration++;
            
            // Wait if ensemble is paused (before any processing)
            await waitWhilePaused();
            
            // Apply thought delay (Mind-specific feature)
            if (iteration > 1) {
                const delay = parseInt(getThoughtDelay());
                if (delay > 0) {
                    await runThoughtDelay();
                }
            }
            
            // Increment request counter for meta-cognition
            taskState.llmRequestCount++;
            
            // Check meta-cognition trigger (Mind-specific feature)
            const metaFrequency = parseInt(taskState.metaFrequency);
            if (taskState.llmRequestCount % metaFrequency === 0) {
                console.log(`[Task] Triggering meta-cognition after ${taskState.llmRequestCount} requests`);
                try {
                    await spawnMetaThought(agentDef, messages, new Date(startTime));
                } catch (error) {
                    console.error('[Task] Error in meta-cognition:', error);
                }
            }
            
            // Run ensemble request and yield all events
            for await (const event of ensembleRequest(messages, agentDef)) {
                // Yield the event to the caller
                yield event;
                
                // Handle tool calls
                if (event.type === 'tool_done' && 'result' in event) {
                    const toolEvent = event as any;
                    const toolName = toolEvent.tool_call?.function?.name;
                    
                    if (toolName === 'task_complete') {
                        isComplete = true;
                        // Emit task_complete event
                        // Note: TaskEvent exists in ensemble but is not included in ProviderStreamEvent
                        // This would require ensemble to be extended
                        yield {
                            type: 'task_complete' as any,
                            result: toolEvent.result?.output || ''
                        };
                    } else if (toolName === 'task_fatal_error') {
                        isComplete = true;
                        // Emit task_fatal_error event
                        yield {
                            type: 'task_fatal_error' as any,
                            result: toolEvent.result?.output || ''
                        };
                    }
                }
                
                // Add response to history
                if (event.type === 'response_output') {
                    const responseEvent = event as any;
                    if (responseEvent.message) {
                        messages.push(responseEvent.message);
                    }
                }
            }
        }

    } catch (error) {
        console.error('[Task] Error running agent:', error);
        
        // Yield an error event
        const errorMessage = error instanceof Error ? error.message : String(error);
        yield {
            type: 'error' as const,
            error: new Error(`Agent execution failed: ${errorMessage}`)
        } as ProviderStreamEvent;
    }
}