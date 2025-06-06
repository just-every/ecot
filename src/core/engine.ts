/**
 * MECH Engine - Simplified Version
 *
 * Meta-cognition Ensemble Chain-of-thought Hierarchy (MECH) implementation.
 * Provides meta-cognition and thought delays on top of ensemble.
 * Model rotation is handled by ensemble automatically.
 */

import { mechState } from '../state/state.js';
import { runThoughtDelay, getThoughtDelay } from './thought_utils.js';
import { spawnMetaThought } from './meta_cognition.js';
import { 
    ensembleRequest,
    createToolFunction,
    cloneAgent,
    type ToolFunction,
    type Agent,
    type ResponseInput,
    type ProviderStreamEvent
} from '@just-every/ensemble';

/**
 * Get MECH control tools
 */
function getMECHTools(): ToolFunction[] {
    return [
        createToolFunction(
            (args: { result: string }) => {
                console.log('[MECH] Task completed:', args.result);
                return `Task completed: ${args.result}`;
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
            (args: { error: string }) => {
                console.error('[MECH] Task failed:', args.error);
                return `Task failed: ${args.error}`;
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
 * Run MECH with automatic everything
 * 
 * @param agent - The agent from ensemble
 * @param content - The task/prompt to execute
 * @returns AsyncGenerator that yields all ProviderStreamEvents
 * 
 * @example
 * ```typescript
 * import { Agent } from '@just-every/ensemble';
 * import { runMECH } from '@just-every/mech';
 * 
 * const agent = new Agent({ 
 *     name: 'MyAgent',
 *     modelClass: 'reasoning' 
 * });
 * 
 * for await (const event of runMECH(agent, 'Analyze this code')) {
 *     console.log(event);
 * }
 * ```
 */
export async function* runMECH(
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
    
    const messages: ResponseInput = [
        {
            type: 'message',
            role: 'system',
            content: agent.instructions 
                ? `${agent.instructions}\n\n${toolGuidance}`
                : toolGuidance
        },
        {
            type: 'message',
            role: 'user',
            content
        }
    ];

    // Add MECH tools to the agent
    const mechTools = getMECHTools();
    
    // Clone agent to get AgentDefinition and add MECH tools
    const agentDef = cloneAgent(agent);
    agentDef.tools = [...mechTools, ...(agent.tools || [])];

    // Track completion state
    let isComplete = false;
    
    try {
        console.log(`[MECH] Starting execution for agent: ${agent.name}`);
        
        // Run the request loop
        let iteration = 0;
        
        while (!isComplete && iteration < 100) {
            iteration++;
            
            // Apply thought delay (MECH-specific feature)
            if (iteration > 1) {
                const delay = parseInt(getThoughtDelay());
                if (delay > 0) {
                    await runThoughtDelay();
                }
            }
            
            // Increment request counter for meta-cognition
            mechState.llmRequestCount++;
            
            // Check meta-cognition trigger (MECH-specific feature)
            const metaFrequency = parseInt(mechState.metaFrequency);
            if (mechState.llmRequestCount % metaFrequency === 0) {
                console.log(`[MECH] Triggering meta-cognition after ${mechState.llmRequestCount} requests`);
                try {
                    await spawnMetaThought(agentDef, messages, new Date(startTime));
                } catch (error) {
                    console.error('[MECH] Error in meta-cognition:', error);
                }
            }
            
            // Run ensemble request and yield all events
            for await (const event of ensembleRequest(messages, agentDef)) {
                // Yield the event to the caller
                yield event;
                
                // Log responses
                if (event.type === 'message_delta' && 'content' in event) {
                    console.log('[MECH]', event.content);
                }
                
                // Handle tool calls
                if (event.type === 'tool_done' && 'result' in event) {
                    const toolEvent = event as any;
                    const toolName = toolEvent.tool_call?.function?.name;
                    
                    if (toolName === 'task_complete') {
                        isComplete = true;
                    } else if (toolName === 'task_fatal_error') {
                        isComplete = true;
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
        console.error('[MECH] Error running agent:', error);
        
        // Yield an error event
        const errorMessage = error instanceof Error ? error.message : String(error);
        yield {
            type: 'error' as const,
            error: new Error(`Agent execution failed: ${errorMessage}`)
        } as ProviderStreamEvent;
    }
}