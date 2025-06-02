/**
 * Simplified MECH API
 * 
 * Easy-to-use functions that require minimal setup
 */

import { runMECH as internalRunMECH } from './mech_tools.js';
import { runMECHWithMemory as internalRunMECHWithMemory } from './mech_memory_wrapper.js';
import type { 
    MechAgent, 
    MechResult, 
    RunMechOptions
} from './types.js';
import { createFullContext, globalCostTracker } from './utils/internal_utils.js';
import { 
    validateRunMechOptions, 
    sanitizeTextInput 
} from './utils/validation.js';
import { withErrorHandling } from './utils/errors.js';

/**
 * Ensure agent has all required methods and fields
 * 
 * This internal helper adds the required export() and getTools() methods
 * if they're not already present, and ensures name and agent_id are set.
 * 
 * @param agent - Agent configuration (all fields optional)
 * @returns Agent with all required methods and fields
 * @internal
 */
function toMechAgent(agent: MechAgent): MechAgent {
    const agentName = agent.name || 'Agent';
    const agentId = agent.agent_id || `${agentName}-${Date.now()}`;
    
    return {
        ...agent,
        name: agentName,
        agent_id: agentId,
        export: agent.export || (() => ({ ...agent } as Record<string, unknown>)),
        getTools: agent.getTools || (async () => agent.tools || [])
    };
}

/**
 * Run MECH with a simple interface
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const result = await runMECH({
 *     agent: { name: 'MyAgent' },
 *     task: 'Analyze this code and suggest improvements'
 * });
 * 
 * // With memory
 * const result = await runMECH({
 *     agent: { name: 'MyAgent' },
 *     task: 'Build a web app',
 *     // Optional memory functions
 *     embed: async (text) => embeddings.create(text),
 *     lookupMemories: async (embedding) => db.findSimilar(embedding),
 *     saveMemory: async (taskId, memories) => db.save(taskId, memories)
 * });
 * ```
 */
export const runMECH = withErrorHandling(
    async (options: RunMechOptions): Promise<MechResult> => {
        // Validate input
        validateRunMechOptions(options);
        
        // Sanitize task input
        const sanitizedTask = sanitizeTextInput(options.task);
        
        const mechAgent = toMechAgent(options.agent);
        const fullContext = createFullContext(options);
        
        // Use memory wrapper if memory functions are provided
        if (options.lookupMemories && options.saveMemory) {
            return internalRunMECHWithMemory(mechAgent, sanitizedTask, fullContext, options.loop);
        } else {
            return internalRunMECH(sanitizedTask, mechAgent, fullContext, options.loop);
        }
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

// Re-export useful types and state management
export type { 
    MechResult, 
    MechOutcome,
    MechAgent,
    RunMechOptions 
} from './types.js';

export { mechState, setMetaFrequency } from './mech_state.js';
export { setThoughtDelay } from './thought_utils.js';