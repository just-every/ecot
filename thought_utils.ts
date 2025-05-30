/**
 * Helper for thought delay processing
 */
import { ToolFunction } from '@just-every/ensemble';
import type { MechContext } from './types.js';
import { VALID_THOUGHT_DELAYS, DEFAULT_THOUGHT_DELAY, MESSAGE_TYPES, type ThoughtDelay } from './constants.js';

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

        // Create a delay promise that can be interrupted
        try {
            await new Promise<void>(resolve => {
                // Break the delay into smaller chunks and check for interruption
                const chunkSize = 100; // Check every 100ms
                let remaining = delayMs * 1000;

                // Set up abort handler
                signal.addEventListener(
                    'abort',
                    () => {
                        // If aborted, resolve immediately
                        resolve();
                    },
                    { once: true }
                );

                function waitChunk() {
                    if (signal.aborted || remaining <= 0) {
                        // If interrupted or completed, resolve immediately
                        resolve();
                        return;
                    }

                    // Wait for the next chunk or the remaining time (whichever is smaller)
                    const waitTime = Math.min(chunkSize, remaining);
                    remaining -= waitTime;

                    setTimeout(() => waitChunk(), waitTime);
                }

                // Start the chunked waiting process
                waitChunk();
            });
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
export function setThoughtDelay(delay: string, _context?: MechContext): string {
    // Validate input type
    if (typeof delay !== 'string') {
        return `Invalid delay type: ${typeof delay}. Must be a string.`;
    }
    
    if (VALID_THOUGHT_DELAYS.includes(delay as ThoughtDelay)) {
        thoughtDelay = delay as ThoughtDelay;
        return `Thought delay set to ${thoughtDelay} seconds`; // Return the success message
    }

    return `Invalid delay: ${delay}. Valid values are: ${VALID_THOUGHT_DELAYS.join(', ')}`;
}

/**
 * Get all thought tools as an array of tool definitions
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