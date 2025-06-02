/**
 * MECH Tools - Enhanced Version
 *
 * Meta-cognition Ensemble Chain-of-thought Hierarchy (MECH) implementation.
 * This version uses ensemble's enhancedRequest for streamlined tool handling.
 */

import type { MechAgent, MechContext, MechOutcome, MechResult } from './types.js';
import { mechState } from './mech_state.js';
import { runThoughtDelay, getThoughtDelay } from './thought_utils.js';
import { spawnMetaThought } from './meta_cognition.js';
import { rotateModel } from './model_rotation.js';
import { 
    request,
    ToolCallAction,
    createRequestContextWithState,
    tool,
    type EnhancedToolFunction,
    type RequestContext
} from '@just-every/ensemble';
import { MESSAGE_TYPES, AGENT_STATUS } from './utils/constants.js';

/**
 * Get MECH control tools using ensemble's ToolBuilder
 */
export function getMECHTools(): EnhancedToolFunction[] {
    return [
        tool('task_complete')
            .description('Report that the task has completed successfully')
            .category('control')
            .constraints({ priority: 100 })
            .hasSideEffects()
            .string('result', 'A few paragraphs describing the result. Be thorough and comprehensive.', true)
            .implement((args: { result: string }) => {
                console.log('[MECH] Task completed:', args.result);
                return `Task completed: ${args.result}`;
            })
            .build(),
            
        tool('task_fatal_error')
            .description('Report that you were not able to complete the task')
            .category('control')
            .constraints({ priority: 100 })
            .hasSideEffects()
            .string('error', 'Describe the error that occurred in a few sentences', true)
            .implement((args: { error: string }) => {
                console.error('[MECH] Task failed:', args.error);
                return `Task failed: ${args.error}`;
            })
            .build()
    ];
}

/**
 * Enhanced MECH execution using ensemble's enhancedRequest
 */
export async function runMECH(
    content: string,
    agent: MechAgent,
    context: MechContext,
    loop = true,
    metadata?: Record<string, any>
): Promise<MechResult> {
    const startTime = Date.now();
    
    // Add initial prompt to history
    context.addHistory({
        type: 'message',
        role: 'user',
        content,
    });

    // Add MECH tools to the agent
    const mechTools = getMECHTools();

    const comm = context.getCommunicationManager();
    
    // Get current messages
    let messages = context.getHistory();
    let currentAgent = agent;
    
    // Allow agent onRequest hook
    if (agent.onRequest) {
        [currentAgent, messages] = await agent.onRequest(agent, messages);
    }
    
    // Combine MECH tools with agent tools
    const allTools = [...mechTools, ...(currentAgent.tools || [])];
    
    // Create request context with state management
    const requestContext = createRequestContextWithState({
        metadata: {
            ...metadata,
            mechOutcome: {} as MechOutcome,
            mechStartTime: startTime
        },
        messages,
        onHalt: () => {
            comm.send({ type: 'MECH_HALTED', timestamp: Date.now() });
        }
    });
    
    // Initialize counter with current global count
    if (mechState.llmRequestCount > 0) {
        for (let i = 0; i < mechState.llmRequestCount; i++) {
            requestContext.incrementCounter('llmRequestCount');
        }
    }
    
    // Load existing model scores from mechState if available
    Object.entries(mechState.modelScores).forEach(([model, score]) => {
        if (typeof score === 'number') {
            requestContext.updateScore(model, score);
        }
    });
    
    // Load disabled models
    mechState.disabledModels.forEach(model => {
        requestContext.disableModel(model);
    });

    // Configure request options
    const requestOptions: any = {
        tools: allTools,
        
        // Tool handler configuration
        toolHandler: {
            context: requestContext,
            
            // Hook for controlling tool execution
            onToolCall: async (toolCall: any, _ctx: any) => {
                // Check for MECH control tools
                const toolName = toolCall.function?.name;
                if (toolName === 'task_complete' || toolName === 'task_fatal_error') {
                    return ToolCallAction.EXECUTE;
                }
                
                // Allow all other tools
                return ToolCallAction.EXECUTE;
            },
            
            // Hook after tool completion
            onToolComplete: async (toolCall: any, result: any, ctx: any) => {
                const reqCtx = ctx as RequestContext;
                
                const toolName = toolCall.function?.name;
                if (toolName === 'task_complete') {
                    reqCtx.setMetadata('mechOutcome', {
                        status: 'complete',
                        result: result
                    });
                    reqCtx.halt();
                } else if (toolName === 'task_fatal_error') {
                    reqCtx.setMetadata('mechOutcome', {
                        status: 'fatal_error',
                        error: result
                    });
                    reqCtx.halt();
                }
            },
            
            executionMode: 'sequential',
            errorStrategy: 'return-error'
        },
        
        // Loop configuration
        loop: loop ? {
            maxIterations: 100,
            continueCondition: async (ctx: any) => {
                // Check if we should continue
                if (!ctx.shouldContinue || ctx.isHalted) {
                    return false;
                }
                
                // Check communication channel
                if (comm.isClosed()) {
                    return false;
                }
                
                return true;
            },
            onIteration: async (_iteration: any, _ctx: any) => {
                // Track LLM requests using context counter
                const requestCount = requestContext.incrementCounter('llmRequestCount');
                // Also update global mechState
                mechState.llmRequestCount = requestCount;
                const metaFrequency = parseInt(mechState.metaFrequency);
                
                if (requestCount % metaFrequency === 0) {
                    console.log(
                        `[MECH] Triggering meta-cognition after ${requestCount} LLM requests`
                    );
                    try {
                        await spawnMetaThought(agent, context, new Date(startTime));
                        
                        // Update model scores based on meta-cognition results
                        const scores = requestContext.getAllScores();
                        Object.entries(scores).forEach(([model, score]) => {
                            mechState.modelScores[model] = score;
                        });
                    } catch (error) {
                        console.error('[MECH] Error in meta-cognition:', error);
                    }
                }
                
                // Process pending history threads
                await context.processPendingHistoryThreads();
                
                // Apply thought delay
                const delay = getThoughtDelay();
                const delayNum = parseInt(delay);
                if (delayNum > 0) {
                    await runThoughtDelay(context);
                }
            }
        } : false,
        
        // Tool result transformation
        toolResultTransformer: {
            augment: (toolName: any, result: any, _metrics: any) => {
                if (toolName === 'task_complete' || toolName === 'task_fatal_error') {
                    const duration = Date.now() - startTime;
                    const totalCost = context.costTracker.getTotalCost();
                    
                    // Record performance metrics
                    if (currentAgent.model) {
                        requestContext.recordRequestTime(currentAgent.model, duration);
                    }
                    
                    return `${result}

=== METRICS ===
Duration  : ${Math.round(duration / 1000)}s
Total cost: $${totalCost.toFixed(6)}`;
                }
                return result;
            }
        },
        
        // Event handling
        eventEmitter: async (event: any, _ctx: any) => {
            if (context.sendStreamEvent) {
                context.sendStreamEvent(event);
            }
        },
        
        // Debugging
        debug: {
            logToolCalls: true,
            logToolResults: true
        }
    };

    try {
        // Send start status
        comm.send({
            type: MESSAGE_TYPES.AGENT_STATUS,
            agent_id: currentAgent.agent_id,
            status: AGENT_STATUS.MECH_START,
            meta_data: {
                model: currentAgent.model,
            },
        });

        // Select model if needed
        let selectedModel = await rotateModel(currentAgent);
        
        // Check if model is disabled in state
        if (selectedModel && requestContext.isModelDisabled(selectedModel)) {
            console.log(`[MECH] Model ${selectedModel} is disabled, selecting alternative`);
            const disabledModels = requestContext.getDisabledModels();
            // Filter out disabled models and retry
            selectedModel = await rotateModel({
                ...currentAgent,
                excludeModels: disabledModels
            } as MechAgent);
        }
        
        if (!selectedModel) {
            throw new Error('No model available for execution');
        }
        
        // Track model usage
        requestContext.incrementCounter(`modelUsage:${selectedModel}`);
        
        // Increment LLM request count for initial request
        const requestCount = requestContext.incrementCounter('llmRequestCount');
        mechState.llmRequestCount = requestCount;
        
        // Run the request
        for await (const event of request(
            selectedModel,
            requestContext.messages,
            requestOptions
        )) {
            // Events are handled by eventEmitter
            // Just need to check for text content to log
            if (event.type === 'message_delta' && 'content' in event) {
                // Log response content if needed
                console.log('[MECH] ', { response: event.content });
            }
        }

        // Get outcome from context
        const outcome = requestContext.getMetadata<MechOutcome>('mechOutcome') || {
            status: 'incomplete',
            error: 'Task did not complete'
        };

        // Send completion status
        comm.send({
            type: MESSAGE_TYPES.AGENT_STATUS,
            agent_id: currentAgent.agent_id,
            status: AGENT_STATUS.MECH_DONE,
            meta_data: {
                model: selectedModel,
                modelScores: requestContext.getAllScores(),
                disabledModels: requestContext.getDisabledModels()
            },
        });

        // Calculate final metrics
        const endTime = Date.now();
        const durationSec = (endTime - startTime) / 1000;
        const totalCost = context.costTracker.getTotalCost();

        return {
            status: outcome?.status === 'complete' || outcome?.status === 'fatal_error' 
                ? outcome.status 
                : 'fatal_error',
            durationSec,
            totalCost,
            history: context.getHistory(),
            mechOutcome: outcome?.status === 'complete' || outcome?.status === 'fatal_error'
                ? outcome
                : { status: 'fatal_error', error: 'Task did not complete' }
        };

    } catch (error) {
        console.error('[MECH] Error running agent:', error);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Send error status
        comm.send({
            type: MESSAGE_TYPES.ERROR,
            error: errorMessage,
        });

        const endTime = Date.now();
        const durationSec = (endTime - startTime) / 1000;
        const totalCost = context.costTracker.getTotalCost();

        return {
            status: 'fatal_error',
            durationSec,
            totalCost,
            history: context.getHistory(),
            mechOutcome: {
                status: 'fatal_error',
                error: `Agent execution failed: ${errorMessage}`
            }
        };
    }
}

// Task completion and error handling are now integrated into getMECHTools