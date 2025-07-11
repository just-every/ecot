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
    TaskEvent,
    MetaMemoryEvent,
    MetaCognitionEvent
} from './src/types/events.js';

// Export TaskLocalState and CognitionState types
export type { TaskLocalState, CognitionState, SerializedCognitionState } from './src/types/task-state.js';

// ============================================================================
// State Management (for debugging/monitoring)
// ============================================================================
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
    // Types
    type MetamemoryState
} from './src/metamemory/index.js';

export type {
    TopicTagMetadata,
    MessageMetadata,
    SerializedMetamemoryState
} from './src/metamemory/types/index.js';

// That's it! Just use runTask(agent, content) and everything else is automatic.


