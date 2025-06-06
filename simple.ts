/**
 * MECH - Simplified API
 * 
 * Single entry point for all MECH functionality
 */

import { runMECHCore } from './mech_tools.js';
import type { Agent } from '@just-every/ensemble';
import type { MechResult } from './types.js';
import { createSimpleContext, globalCostTracker } from './utils/internal_utils.js';
import { sanitizeTextInput } from './utils/validation.js';
import { withErrorHandling } from './utils/errors.js';


/**
 * Run MECH with automatic everything
 * 
 * @param agent - The agent from ensemble
 * @param content - The task/prompt to execute
 * @returns Result with status, history, cost, and duration
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
 * const result = await runMECH(agent, 'Analyze this code');
 * ```
 */
export const runMECH = withErrorHandling(
    async (agent: Agent, content: string): Promise<MechResult> => {
        // Simple validation
        if (!agent || typeof agent !== 'object') {
            throw new Error('Agent must be a valid Agent instance');
        }
        if (!content || typeof content !== 'string') {
            throw new Error('Content must be a non-empty string');
        }
        
        // Sanitize input
        const sanitizedContent = sanitizeTextInput(content);
        if (!sanitizedContent || sanitizedContent.trim().length === 0) {
            throw new Error('Content cannot be empty after sanitization');
        }
        
        // Create minimal context - everything is automatic
        const context = createSimpleContext();
        
        // Run MECH with all features enabled by default
        return runMECHCore(sanitizedContent, agent, context);
    },
    'simple_api'
);


/**
 * Get the total cost of all MECH operations
 */
/**
 * Get the cumulative cost of all MECH operations in the current session
 * 
 * Tracks costs across all LLM requests, tool executions, and memory operations.
 * Useful for monitoring usage and implementing cost controls.
 * 
 * @returns Total cost in USD as a decimal number
 * 
 * @example
 * ```typescript
 * const cost = getTotalCost();
 * console.log(`Total spent: $${cost.toFixed(4)}`);
 * 
 * // Reset for new session
 * resetCostTracker();
 * ```
 */
export function getTotalCost(): number {
    return globalCostTracker.getTotalCost();
}

/**
 * Reset the cost tracker
 */
/**
 * Reset the cost tracking system to zero
 * 
 * Clears all accumulated cost data from the current session.
 * Typically called at the start of new tasks or billing periods.
 * 
 * @example
 * ```typescript
 * // Start fresh cost tracking
 * resetCostTracker();
 * await runMECH(agent, task, options);
 * const sessionCost = getTotalCost();
 * ```
 */
export function resetCostTracker(): void {
    globalCostTracker.reset();
}

// Re-export only essential types
export type { MechResult, MechOutcome } from './types.js';
export type { Agent } from '@just-every/ensemble';

// State management - kept simple
export { mechState } from './mech_state.js';