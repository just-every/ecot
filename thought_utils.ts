/**
 * Helper for thought delay processing
 */
import { ToolFunction } from '@just-every/ensemble';
import type { MechContext } from './types.js';
import { VALID_THOUGHT_DELAYS, DEFAULT_THOUGHT_DELAY, MESSAGE_TYPES, type ThoughtDelay } from './utils/constants.js';
import { OptimizedThoughtDelay } from './utils/performance.js';
import { validateThoughtDelay } from './utils/validation.js';
import { withErrorHandling } from './utils/errors.js';

// Thought utilities for managing thought delay and related tools

export let thoughtDelay: ThoughtDelay = DEFAULT_THOUGHT_DELAY;
// Use AbortController for interrupting thought delays
let delayAbortController = new AbortController();

export function setDelayInterrupted(interrupted: boolean): void {
    try {
        if (interrupted) {
            // If we're interrupting, abort the current controller
            delayAbortController.abort();
        } else {
            // If we're clearing the interruption, create a new controller
            delayAbortController = new AbortController();
        }
    } catch (error) {
        console.error('[ThoughtDelay] Error setting delay interrupted state:', error);
        // Create a new controller as fallback
        delayAbortController = new AbortController();
    }
}

export function isDelayInterrupted(): boolean {
    return delayAbortController.signal.aborted;
}

// Get the current abort signal for thought delay
export function getDelayAbortSignal(): AbortSignal {
    return delayAbortController.signal;
}

export function getThoughtDelay(): string {
    return thoughtDelay;
}
export function getValidThoughtDelays(): readonly string[] {
    return VALID_THOUGHT_DELAYS;
}

/**
 * Execute an optimized thought delay with interrupt support
 * 
 * Implements intelligent delays between agent thoughts to:
 * - Allow time for external processes to complete
 * - Provide natural pacing for complex reasoning
 * - Enable interruption for urgent messages or user input
 * 
 * Uses AbortController for clean cancellation and sends status updates
 * through the communication system.
 * 
 * @param context - Optional MECH context for status reporting
 * @returns Promise that resolves when delay completes or is interrupted
 * 
 * @example
 * ```typescript
 * // Basic delay execution
 * await runThoughtDelay(context);
 * 
 * // With interruption handling
 * try {
 *   await runThoughtDelay(context);
 * } catch (error) {
 *   console.log('Delay was interrupted');
 * }
 * ```
 */
export async function runThoughtDelay(context?: MechContext): Promise<void> {
    const delayMs = parseInt(thoughtDelay);
    
    if (thoughtDelay && !isNaN(delayMs) && delayMs > 0) {
        // Send status message when starting delay
        if (context?.sendComms) {
            context.sendComms({
                type: MESSAGE_TYPES.THOUGHT_DELAY,
                delayMs: parseInt(thoughtDelay) * 1000
            });
        }
        
        // Create a new controller for this delay
        delayAbortController = new AbortController();
        const signal = delayAbortController.signal;

        // Use optimized delay implementation
        try {
            await OptimizedThoughtDelay.runDelay(
                delayMs * 1000, // Convert to milliseconds
                signal,
                (remaining) => {
                    // Optional: Send progress updates
                    if (context?.sendComms) {
                        context.sendComms({
                            type: MESSAGE_TYPES.AGENT_STATUS,
                            status: 'thinking',
                            remainingMs: remaining
                        });
                    }
                }
            );
        } catch (error) {
            // Just suppress errors from abortion
            console.log('[ThoughtDelay] Delay was aborted');
        } finally {
            // Reset interrupted state and send completion message
            setDelayInterrupted(false);
            if (context?.sendComms) {
                context.sendComms({
                    type: MESSAGE_TYPES.THOUGHT_COMPLETE
                });
            }
        }
    } else {
        // No delay, but still send messages for consistency
        if (context?.sendComms) {
            context.sendComms({
                type: MESSAGE_TYPES.THOUGHT_DELAY,
                delayMs: 0
            });
            context.sendComms({
                type: MESSAGE_TYPES.THOUGHT_COMPLETE
            });
        }
    }
}

/**
 * Sets a new thought level and delay for future thoughts
 *
 * @param level The message content to process.
 * @returns A promise that resolves with a success message after the calculated delay.
 */
export const setThoughtDelay = withErrorHandling(
    (delay: string, _context?: MechContext): string => {
        validateThoughtDelay(delay);
        thoughtDelay = delay as ThoughtDelay;
        console.log(`[MECH] Thought delay set to ${thoughtDelay} seconds`);
        return `Thought delay set to ${thoughtDelay} seconds`;
    },
    'thought_management'
);

/**
 * Get thought management tools for dynamic delay control
 * 
 * These tools allow agents or metacognition to adjust their thinking pace
 * in response to task complexity or external conditions. Provides runtime
 * control over the thought delay system.
 * 
 * @param context - MECH execution context for tool creation
 * @returns Array of tools for thought delay management
 * 
 * @example
 * ```typescript
 * const thoughtTools = getThoughtTools(context);
 * agent.tools.push(...thoughtTools);
 * 
 * // Agent can now use setThoughtDelay tool to adjust pacing
 * ```
 */
export function getThoughtTools(context: MechContext): ToolFunction[] {
    if (!context.createToolFunction) {
        return [];
    }
    
    return [
        context.createToolFunction(
            (params: { delay: string }) => setThoughtDelay(params.delay, context),
            'Sets the Thought Delay for your next set of thoughts. Can be changed any time. Extend your Delay to think slower while waiting.',
            {
                delay: {
                    description:
                        'The new Thought Delay. Will set to the number of seconds between your thoughts. New messages and system events will interrupt your thought delay to ensure you can respond to them.',
                    enum: getValidThoughtDelays(),
                },
            }
        ),
    ];
}