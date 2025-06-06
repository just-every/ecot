/**
 * MECH - Simplified API
 * 
 * Single entry point for all MECH functionality
 */

import { runMECHCore } from './src/core/engine.js';
import type { Agent } from '@just-every/ensemble';
import type { MechResult } from './src/state/types.js';


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
export async function runMECH(agent: Agent, content: string): Promise<MechResult> {
    // Basic validation
    if (!agent || typeof agent !== 'object') {
        throw new Error('Agent must be a valid Agent instance');
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
        throw new Error('Content must be a non-empty string');
    }
    
    // Run MECH with all features enabled by default
    return runMECHCore(content.trim(), agent);
}


// Re-export only essential types
export type { MechResult, MechOutcome } from './src/state/types.js';
export type { Agent } from '@just-every/ensemble';