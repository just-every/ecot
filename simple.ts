/**
 * MECH - Simplified API
 * 
 * Single entry point for all MECH functionality
 */

import { runMECHCore } from './mech_tools.js';
import type { Agent } from '@just-every/ensemble';
import type { MechResult } from './types.js';
import { createSimpleContext } from './utils/internal_utils.js';
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


// Re-export only essential types
export type { MechResult, MechOutcome } from './types.js';
export type { Agent } from '@just-every/ensemble';