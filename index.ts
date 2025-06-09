/**
 * @just-every/mind
 * 
 * Mind - Advanced LLM orchestration with meta-cognition
 * 
 * This module provides the Mind system which includes:
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
    mindTask,
} from './src/core/engine.js';

// ============================================================================
// Core Types
// ============================================================================

// Re-export Agent from ensemble
export type { Agent } from '@just-every/ensemble';

// ============================================================================
// State Management (for debugging/monitoring)
// ============================================================================
export { 
    mindState, 
    resetLLMRequestCount,
    setMetaFrequency,
    setModelScore,
    getModelScore,
    disableModel,
    listDisabledModels,
    listModelScores
} from './src/state/state.js';

export { 
    setThoughtDelay,
    getThoughtDelay
} from './src/core/thought_utils.js';

// ============================================================================
// Pause Control (from ensemble)
// ============================================================================
export { 
    pause, 
    resume, 
    isPaused, 
    getPauseController,
    waitWhilePaused,
    type PauseController
} from '@just-every/ensemble';

// That's it! Just use mindTask(agent, content) and everything else is automatic.


