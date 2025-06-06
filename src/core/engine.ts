/**
 * MECH Engine - Simplified Version
 *
 * Meta-cognition Ensemble Chain-of-thought Hierarchy (MECH) implementation.
 * Provides model rotation, meta-cognition, and thought delays on top of ensemble.
 */

import type { MechOutcome, MechResult } from '../state/types.js';
import { mechState } from '../state/state.js';
import { runThoughtDelay, getThoughtDelay } from './thought_utils.js';
import { spawnMetaThought } from './meta_cognition.js';
import { rotateModel } from './model_rotation.js';
import { 
    ensembleRequest,
    createToolFunction,
    type ToolFunction,
    type Agent,
    type ResponseInput,
    type AgentDefinition,
    CostTracker
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
 * Core MECH execution loop - simplified version
 */
export async function runMECHCore(
    content: string,
    agent: Agent
): Promise<MechResult> {
    const startTime = Date.now();
    const costTracker = new CostTracker();
    
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
    const enhancedAgent: AgentDefinition = {
        agent_id: agent.agent_id,
        name: agent.name,
        description: agent.description,
        instructions: agent.instructions,
        model: agent.model,
        modelClass: agent.modelClass,
        modelSettings: agent.modelSettings,
        tools: [...mechTools, ...(agent.tools || [])],
        maxToolCalls: agent.maxToolCalls,
        onToolResult: agent.onToolResult
    };

    // Track outcome locally
    let mechOutcome: MechOutcome | undefined;
    let isComplete = false;
    
    try {
        // Select model if needed (MECH-specific feature)
        if (!enhancedAgent.model) {
            const selectedModel = await rotateModel(enhancedAgent);
            if (!selectedModel) {
                throw new Error('No model available for execution');
            }
            enhancedAgent.model = selectedModel;
            mechState.lastModelUsed = selectedModel;
        }

        console.log(`[MECH] Starting with model: ${enhancedAgent.model}`);
        
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
                    await spawnMetaThought(enhancedAgent, messages, new Date(startTime));
                } catch (error) {
                    console.error('[MECH] Error in meta-cognition:', error);
                }
            }
            
            // Run ensemble request
            for await (const event of ensembleRequest(messages, enhancedAgent)) {
                // Track costs
                if (event.type === 'cost_update' && 'usage' in event) {
                    costTracker.addUsage(event as any);
                }
                
                // Log responses
                if (event.type === 'message_delta' && 'content' in event) {
                    console.log('[MECH]', event.content);
                }
                
                // Handle tool calls
                if (event.type === 'tool_done' && 'result' in event) {
                    const toolEvent = event as any;
                    const toolName = toolEvent.tool_call?.function?.name;
                    
                    if (toolName === 'task_complete') {
                        mechOutcome = {
                            status: 'complete',
                            result: toolEvent.result?.output
                        };
                        isComplete = true;
                    } else if (toolName === 'task_fatal_error') {
                        mechOutcome = {
                            status: 'fatal_error',
                            error: toolEvent.result?.output
                        };
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
            
            // Check if we should continue
            if (mechOutcome && (mechOutcome.status === 'complete' || mechOutcome.status === 'fatal_error')) {
                isComplete = true;
            }
        }

        // Get final outcome
        const outcome = mechOutcome || {
            status: 'incomplete' as const,
            error: 'Task did not complete'
        };

        // Calculate final metrics
        const endTime = Date.now();
        const durationSec = (endTime - startTime) / 1000;
        const totalCost = costTracker.getTotalCost();

        return {
            status: outcome.status === 'complete' || outcome.status === 'fatal_error' 
                ? outcome.status 
                : 'fatal_error',
            durationSec,
            totalCost,
            history: messages,
            mechOutcome: outcome.status === 'complete' || outcome.status === 'fatal_error'
                ? outcome
                : { status: 'fatal_error', error: 'Task did not complete' }
        };

    } catch (error) {
        console.error('[MECH] Error running agent:', error);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        const endTime = Date.now();
        const durationSec = (endTime - startTime) / 1000;
        const totalCost = costTracker.getTotalCost();

        return {
            status: 'fatal_error',
            durationSec,
            totalCost,
            history: messages,
            mechOutcome: {
                status: 'fatal_error',
                error: `Agent execution failed: ${errorMessage}`
            }
        };
    }
}