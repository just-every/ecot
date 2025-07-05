/**
 * @just-every/task
 * 
 * Task - Advanced LLM orchestration with meta-cognition
 * 
 * This module provides the Task system which includes:
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
    runTask,
    // Resume a task from a previous state
    resumeTask,
    // Add messages to an active task
    addMessageToTask,
    // Get compacted history from metamemory
    getCompactedHistory,
    // Check if metamemory is ready
    isMetamemoryReady,
    // Types for initial state
    type InitialTaskState
} from './src/core/engine.js';

// ============================================================================
// Core Types
// ============================================================================

// Re-export Agent from ensemble
export type { Agent } from '@just-every/ensemble';

// Export task-specific event types
export type { 
    TaskCompleteEvent, 
    TaskFatalErrorEvent, 
    TaskEvent 
} from './src/types/events.js';

// ============================================================================
// State Management (for debugging/monitoring)
// ============================================================================
export { 
    taskState, 
    resetLLMRequestCount,
    set_meta_frequency,
    set_model_score,
    getModelScore,
    disable_model,
    listDisabledModels,
    listModelScores,
    configureMetamemory,
    setMetamemoryEnabled
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

// ============================================================================
// Metamemory (for conversation compaction)
// ============================================================================
export {
    // Main class and functions
    Metamemory,
    createMetamemoryState,
    // Types
    type MetamemoryState
} from './src/metamemory/index.js';

// That's it! Just use runTask(agent, content) and everything else is automatic.


