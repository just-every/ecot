/**
 * MECH Tools
 *
 * Meta-cognition Ensemble Chain-of-thought Hierarchy (MECH) implementation.
 * This file replaces the previous MEC (Multi-Ensemble Chain) implementation
 * with the more advanced MECH system that adds meta-cognition and hierarchy capabilities.
 */

import type { MechAgent, MechContext, MechOutcome, MechResult } from './types.js';
import { mechState, incrementLLMRequestCount } from './mech_state.js';
import { runThoughtDelay, getThoughtDelay } from './thought_utils.js';
import { spawnMetaThought } from './meta_cognition.js';
import { rotateModel } from './model_rotation.js';
import { ToolFunction } from '@just-every/ensemble';
import { MESSAGE_TYPES, AGENT_STATUS, TASK_STATUS, DEFAULT_META_FREQUENCY } from './utils/constants.js';

// Shared state for MECH execution
let mechComplete = false;
let mechOutcome: MechOutcome = {};

// Track task start time for duration calculation
let taskStartTime = new Date();

/**
 * Runs the Meta-cognition Ensemble Chain-of-thought Hierarchy (MECH)
 *
 * @param agent - The agent to run
 * @param content - The user input to process
 * @param context - The MECH context containing required utilities
 * @param loop - Whether to loop continuously or exit after completion
 * @param model - Optional fixed model to use (if not provided, models will rotate based on hierarchy scores)
 * @returns Promise that resolves to a MechResult containing status, cost, and duration
 */
export async function runMECH(
    agent: MechAgent,
    content: string,
    context: MechContext,
    loop: boolean = false,
    model?: string
): Promise<MechResult> {
    // Validate inputs
    if (!agent || typeof agent !== 'object') {
        throw new TypeError('Invalid agent: must be a valid MechAgent object');
    }
    
    if (!content || typeof content !== 'string') {
        throw new TypeError('Invalid content: must be a non-empty string');
    }
    
    if (!context || typeof context !== 'object') {
        throw new TypeError('Invalid context: must be a valid MechContext object');
    }
    
    console.log(`Running MECH with command: ${content}`);

    // Reset state for this run
    mechComplete = false;
    mechOutcome = {};

    // Start timing
    const startTime = new Date();
    taskStartTime = startTime;
    const costBaseline = context.costTracker.getTotalCost();

    // Reset the meta-cognition state
    mechState.llmRequestCount = 0;
    mechState.disabledModels.clear();
    mechState.modelScores = {};
    mechState.lastModelUsed = undefined;
    mechState.metaFrequency = DEFAULT_META_FREQUENCY;

    // Add initial prompt to history
    context.addHistory({
        type: 'message',
        role: 'user',
        content,
    });

    // Add MECH tools to the agent
    agent.tools = agent.tools || [];
    agent.tools.unshift(...getMECHTools(context));

    const comm = context.getCommunicationManager();

    do {
        try {
            // Check if we need to trigger meta-cognition
            const { shouldTriggerMeta } = incrementLLMRequestCount();
            if (shouldTriggerMeta) {
                console.log(
                    `[MECH] Triggering meta-cognition after ${mechState.llmRequestCount} LLM requests`
                );
                try {
                    await spawnMetaThought(agent, context, startTime);
                } catch (error) {
                    console.error('[MECH] Error in meta-cognition:', error);
                }
            }

            // Process any pending history threads at the start of each mech loop
            await context.processPendingHistoryThreads();

            // Rotate the model using the MECH hierarchy-aware rotation (influenced by model scores)
            try {
                agent.model = model || await rotateModel(agent);
            } catch (rotationError) {
                console.error('[MECH] Error rotating model:', rotationError);
                // Fall back to agent's default model if rotation fails
                if (!agent.model) {
                    throw new Error('No model available for agent');
                }
            }
            // Note: modelSettings deletion is handled by the runner

            context.sendComms({
                type: MESSAGE_TYPES.AGENT_STATUS,
                agent_id: agent.agent_id,
                status: AGENT_STATUS.MECH_START,
                meta_data: {
                    model: model,
                },
            });

            // Run the command with unified tool handling
            // Note: The actual runner execution is provided by the context
            let response;
            if (context.runStreamedWithTools) {
                try {
                    response = await context.runStreamedWithTools(
                        agent,
                        '',
                        context.getHistory()
                    );
                } catch (runError) {
                    console.error('[MECH] Error running agent:', runError);
                    throw runError;
                }
            } else {
                throw new Error('runStreamedWithTools not provided in context');
            }

            console.log('[MECH] ', response);

            context.sendComms({
                type: MESSAGE_TYPES.AGENT_STATUS,
                agent_id: agent.agent_id,
                status: AGENT_STATUS.MECH_DONE,
                meta_data: {
                    model: model,
                },
            });

            if (!mechComplete) {
                // Let magi know our progress
                comm.send({
                    type: MESSAGE_TYPES.PROCESS_UPDATED,
                    history: context.getHistory(),
                });

                context.sendComms({
                    type: MESSAGE_TYPES.AGENT_STATUS,
                    agent_id: agent.agent_id,
                    status: AGENT_STATUS.THOUGHT_DELAY,
                    meta_data: {
                        seconds: getThoughtDelay(),
                    },
                });

                // Wait the required delay before the next thought
                await runThoughtDelay(context);
            }
        } catch (error: any) {
            // Handle any error that occurred during agent execution
            console.error(
                `Error running agent command: ${error?.message || String(error)}`
            );
            comm.send({ type: MESSAGE_TYPES.ERROR, error });
            
            // Set fatal error status in mechOutcome
            taskFatalError(
                `Agent execution failed: ${error?.message || String(error)}`,
                context
            );
            break; // Exit the loop immediately on error
        }
    } while (!mechComplete && loop && !comm.isClosed());

    // Calculate performance metrics
    const durationSec = Math.round(
        (new Date().getTime() - startTime.getTime()) / 1000
    );
    const totalCost = context.costTracker.getTotalCost() - costBaseline;

    // Build and return the appropriate result object
    if (mechOutcome.status === TASK_STATUS.COMPLETE) {
        return {
            status: TASK_STATUS.COMPLETE,
            mechOutcome,
            history: context.getHistory(),
            durationSec,
            totalCost,
        };
    } else if (mechOutcome.status === TASK_STATUS.FATAL_ERROR) {
        return {
            status: TASK_STATUS.FATAL_ERROR,
            mechOutcome,
            history: context.getHistory(),
            durationSec,
            totalCost,
        };
    } else {
        // Default case if no explicit outcome was set but mechComplete is true
        console.warn(
            'MECH completed but no outcome status was set, assuming success'
        );
        return {
            status: TASK_STATUS.COMPLETE,
            history: context.getHistory(),
            durationSec,
            totalCost,
        };
    }
}

/**
 * Mark a task as successfully completed with automatic metrics reporting
 * 
 * This function should be called when the agent has successfully completed
 * its assigned task. It automatically calculates execution metrics, triggers
 * git repository handling, and provides comprehensive completion reporting.
 * 
 * @param result - Detailed description of what was accomplished
 * @param context - MECH execution context with communication capabilities
 * @returns Promise resolving to formatted completion message with execution metrics
 * 
 * @example
 * ```typescript
 * await taskComplete(
 *   "Successfully analyzed the codebase and identified 3 optimization opportunities",
 *   context
 * );
 * ```
 */
export async function taskComplete(result: string, context: MechContext): Promise<string> {
    if (typeof result !== 'string') {
        result = String(result || 'Task completed');
    }
    
    console.log(`[TaskRun] Task completed successfully: ${result}`);

    // Calculate metrics for immediate use in the response
    const durationSec = Math.round(
        (new Date().getTime() - taskStartTime.getTime()) / 1000
    );
    const totalCost = context.costTracker.getTotalCost();

    // Add metrics to the result message
    const resultWithMetrics = `${result}\n\n=== METRICS ===\nDuration  : ${durationSec}s\nTotal cost: $${totalCost.toFixed(6)}`;

    mechComplete = true;
    mechOutcome = {
        status: TASK_STATUS.COMPLETE,
        result,
        event: {
            type: 'process_done',
            output: resultWithMetrics,
            history: context.getHistory(),
        } as any,
    };

    return `Task ended successfully\n\n${resultWithMetrics}`;
}

/**
 * Report a fatal error that prevents task completion
 * 
 * Use this function when the agent encounters an unrecoverable error
 * that makes task completion impossible. This triggers error reporting
 * and cleanup procedures.
 * 
 * @param error - Detailed description of the fatal error that occurred
 * @param context - MECH execution context for error reporting
 * @returns Formatted error message with diagnostic information
 * 
 * @example
 * ```typescript
 * const errorMsg = taskFatalError(
 *   "Unable to access required API endpoint after 3 retry attempts",
 *   context
 * );
 * ```
 */
export function taskFatalError(error: string, context: MechContext): string {
    if (typeof error !== 'string') {
        error = String(error || 'Unknown error');
    }
    
    console.error(`[TaskRun] Task failed: ${error}`);

    // Calculate metrics for immediate use in the response
    const durationSec = Math.round(
        (new Date().getTime() - taskStartTime.getTime()) / 1000
    );
    const totalCost = context.costTracker.getTotalCost();

    // Add metrics to the error message
    const errorWithMetrics = `Error: ${error}\n\n=== METRICS ===\nDuration  : ${durationSec}s\nTotal cost: $${totalCost.toFixed(6)}`;

    mechComplete = true;
    mechOutcome = {
        status: TASK_STATUS.FATAL_ERROR,
        error,
        event: {
            type: 'process_failed',
            error: errorWithMetrics,
            history: context.getHistory(),
        } as any,
    };

    return `Task failed\n\n${errorWithMetrics}`;
}

/**
 * Get all MECH core tools that enable task completion and error reporting
 * 
 * These tools are automatically added to agents and provide the fundamental
 * capabilities for task lifecycle management. All MECH agents receive these
 * tools regardless of their custom tool configuration.
 * 
 * @param context - MECH execution context for tool creation
 * @returns Array of tool functions for task management
 * 
 * @example
 * ```typescript
 * const coreTools = getMECHTools(context);
 * const allTools = [...coreTools, ...customTools];
 * ```
 */
export function getMECHTools(context: MechContext): ToolFunction[] {
    if (!context.createToolFunction) {
        return [];
    }
    
    return [
        context.createToolFunction(
            function task_complete(result: string) { return taskComplete(result, context); },
            'Report that the task has completed successfully',
            {
                result: 'A few paragraphs describing the result of the task. Include any assumptions you made, problems overcome and what the final outcome was.',
            }
        ),
        context.createToolFunction(
            function task_fatal_error(error: string) { return taskFatalError(error, context); },
            'Report that you were not able to complete the task',
            { error: 'Describe the error that occurred in a few sentences' }
        ),
    ];
}