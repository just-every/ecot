/**
 * Helper for thought delay processing
 */
import { ToolFunction, createToolFunction } from '@just-every/ensemble';
import { VALID_THOUGHT_DELAYS, DEFAULT_THOUGHT_DELAY, type ThoughtDelay } from '../utils/constants.js';
import { validateThoughtDelay } from '../utils/validation.js';
import { withErrorHandling } from '../utils/errors.js';

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
 * Uses AbortController for clean cancellation.
 * 
 * @returns Promise that resolves when delay completes or is interrupted
 * 
 * @example
 * ```typescript
 * // Basic delay execution
 * await runThoughtDelay();
 * 
 * // With interruption handling
 * try {
 *   await runThoughtDelay();
 * } catch (error) {
 *   console.log('Delay was interrupted');
 * }
 * ```
 */
export async function runThoughtDelay(): Promise<void> {
    const delayMs = parseInt(thoughtDelay);
    
    if (thoughtDelay && !isNaN(delayMs) && delayMs > 0) {
        console.log(`[Task] Thought delay: ${delayMs} seconds`);
        
        // Create a new controller for this delay
        delayAbortController = new AbortController();
        const signal = delayAbortController.signal;

        // Simple delay implementation
        try {
            await new Promise<void>((resolve, reject) => {
                const timeoutId = setTimeout(resolve, delayMs * 1000);
                
                signal.addEventListener('abort', () => {
                    clearTimeout(timeoutId);
                    const error = new Error('Delay was aborted');
                    error.name = 'AbortError';
                    reject(error);
                }, { once: true });
            });
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('[Task] Thought delay interrupted');
                throw error;
            }
            throw error;
        }
    }
}

/**
 * Set the thought delay for the agent
 * @param delay - The delay to set (0, 2, 4, 8, 16, 32, 64, or 128 seconds)
 * @returns The new delay value or error message
 */
export const setThoughtDelay = withErrorHandling(
    (delay: string): string => {
        validateThoughtDelay(delay);
        thoughtDelay = delay as ThoughtDelay;
        console.log(`[Task] Thought delay set to ${delay} seconds`);
        return `Thought delay set to ${thoughtDelay} seconds`;
    },
    'thought_management'
);

/**
 * Get thought management tools
 * 
 * @returns Array of tool functions for managing thought delays
 */
export function getThoughtTools(): ToolFunction[] {
    const tools: ToolFunction[] = [];
    
    tools.push(
        createToolFunction(
            setThoughtDelay,
            'Change the delay between agent thoughts',
            {
                delay: {
                    type: 'string',
                    description: 'Delay in seconds (0, 2, 4, 8, 16, 32, 64, or 128)',
                    enum: VALID_THOUGHT_DELAYS as unknown as string[],
                },
            },
            undefined,
            'set_thought_delay'
        ),
        createToolFunction(
            () => {
                setDelayInterrupted(true);
                return 'Thought delay interrupted';
            },
            'Interrupt the current thought delay to proceed immediately',
            {},
            undefined,
            'interrupt_delay'
        ),
        createToolFunction(
            () => {
                return `Current thought delay: ${thoughtDelay} seconds`;
            },
            'Get the current thought delay setting',
            {},
            undefined,
            'get_thought_delay'
        )
    );
    
    return tools;
}