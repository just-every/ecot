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
    SimpleAgent,
    RunMechOptions,
    SimpleMechOptions,
    SimpleMechWithMemoryOptions
} from './types.js';
import { createFullContext, globalCostTracker } from './utils/internal_utils.js';
import { 
    validateSimpleMechOptions, 
    validateSimpleMechWithMemoryOptions, 
    sanitizeTextInput 
} from './utils/validation.js';
import { withErrorHandling } from './utils/errors.js';

/**
 * Convert a simple agent to MechAgent
 */
/**
 * Convert a simple agent to MechAgent format with full MECH capabilities
 * 
 * @param agent - Simple agent configuration with minimal required fields
 * @returns Full MechAgent with auto-generated ID, timestamps, and default capabilities
 * @internal
 */
function toMechAgent(agent: SimpleAgent): MechAgent {
    return {
        name: agent.name,
        agent_id: agent.agent_id || `${agent.name}-${Date.now()}`,
        model: agent.model,
        modelClass: agent.modelClass,
        tools: [],  // Tools will be added by MECH
        instructions: agent.instructions,
        export: () => ({ ...agent } as Record<string, unknown>),
        getTools: async () => []  // Tools will be added by MECH
    };
}

/**
 * Run MECH with a simple interface
 * 
 * @example
 * ```typescript
 * const result = await runMECH({
 *     agent: { name: 'MyAgent' },
 *     task: 'Analyze this code and suggest improvements',
 *     runAgent: async (agent, input, history) => {
 *         // Your LLM call here
 *         return { response: 'Analysis complete' };
 *     }
 * });
 * ```
 */
export const runMECH = withErrorHandling(
    async (options: RunMechOptions): Promise<MechResult> => {
        // Validate input
        validateSimpleMechOptions(options);
        
        // Sanitize task input
        const sanitizedTask = sanitizeTextInput(options.task);
        
        const mechAgent = toMechAgent(options.agent);
        const context: SimpleMechOptions = {
            runAgent: options.runAgent,
            onHistory: options.onHistory,
            onStatus: options.onStatus
        };
        
        const fullContext = createFullContext(context);
        return internalRunMECH(mechAgent, sanitizedTask, fullContext, options.loop || false, options.model);
    },
    'simple_api'
);

/**
 * Run MECH with memory using a simple interface
 * 
 * @example
 * ```typescript
 * const result = await runMECHWithMemory({
 *     agent: { name: 'MyAgent' },
 *     task: 'Build a web app',
 *     runAgent: async (agent, input, history) => {
 *         // Your LLM call here
 *         return { response: 'App built' };
 *     },
 *     // Optional memory functions
 *     embed: async (text) => embeddings.create(text),
 *     lookupMemories: async (embedding) => db.findSimilar(embedding)
 * });
 * ```
 */
export const runMECHWithMemory = withErrorHandling(
    async (options: SimpleMechWithMemoryOptions): Promise<MechResult> => {
        // Validate input including memory-specific requirements
        validateSimpleMechWithMemoryOptions(options);
        
        // Sanitize task input
        const sanitizedTask = sanitizeTextInput(options.task);
        
        const mechAgent = toMechAgent(options.agent);
        
        // Build context with memory features
        const context: SimpleMechOptions = {
            runAgent: options.runAgent,
            onHistory: options.onHistory,
            onStatus: options.onStatus,
            embed: options.embed,
            lookupMemories: options.lookupMemories,
            saveMemory: options.saveMemory
        };
        
        const fullContext = createFullContext(context);
        return internalRunMECHWithMemory(mechAgent, sanitizedTask, fullContext);
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
    SimpleAgent,
    RunMechOptions 
} from './types.js';

export { mechState, setMetaFrequency } from './mech_state.js';
export { setThoughtDelay } from './thought_utils.js';