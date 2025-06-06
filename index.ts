/**
 * @just-every/mech
 * 
 * MECH - Advanced LLM orchestration with meta-cognition
 * 
 * This module provides the MECH system which includes:
 * - Hierarchical model selection based on performance scores
 * - Meta-cognition for self-reflection and strategy adjustment
 * - Thought delay management for pacing
 * - Memory integration for learning from past tasks
 */

// ============================================================================
// Main API - Single simple interface
// ============================================================================
export {
    // The one and only function you need
    runMECH,
} from './api.js';

// ============================================================================
// Core Types
// ============================================================================
export type {
    // Result types
    MechResult,
    MechOutcome,
} from './src/state/types.js';

// Re-export Agent from ensemble
export type { Agent } from '@just-every/ensemble';

// ============================================================================
// State Management (for debugging/monitoring)
// ============================================================================
export { 
    mechState, 
    resetLLMRequestCount 
} from './src/state/state.js';

export { 
    setThoughtDelay,
    getThoughtDelay,
    setDelayInterrupted,
    isDelayInterrupted,
    runThoughtDelay,
    getDelayAbortSignal,
    getThoughtTools
} from './src/core/thought_utils.js';

// ============================================================================
// Constants (for testing and advanced usage)
// ============================================================================
export { MESSAGE_TYPES } from './src/utils/constants.js';

// That's it! Just use runMECH(agent, content) and everything else is automatic.


