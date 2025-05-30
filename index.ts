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
// Simple API - Primary interface for most users
// ============================================================================
export {
    // Main functions
    runMECH,
    runMECHWithMemory,
    getTotalCost,
    resetCostTracker,
    
    // Types
    type SimpleAgent,
    type RunMechOptions,
} from './simple.js';

// ============================================================================
// Core Types
// ============================================================================
export type {
    // Result types
    MechResult,
    MechOutcome,
    
    // Configuration
    MechConfig,
    
    // Agent types
    MechAgent,
    AgentTool,
    
    // Context types (for advanced users)
    MechContext,
    SimpleMechOptions,
    
    // Helper types
    LLMResponse,
    MemoryItem,
} from './types.js';

// ============================================================================
// State Management
// ============================================================================
export {
    // State object
    mechState,
    
    // State modification functions
    setMetaFrequency,
    getMetaFrequency,
    setModelScore,
    disableModel,
    enableModel,
    listDisabledModels,
    listModelScores,
    getModelScore,
    incrementLLMRequestCount,
    resetLLMRequestCount,
} from './mech_state.js';

// ============================================================================
// Thought Management
// ============================================================================
export {
    getThoughtDelay,
    setThoughtDelay,
    runThoughtDelay,
    setDelayInterrupted,
    isDelayInterrupted,
} from './thought_utils.js';

// ============================================================================
// Advanced API - For users who need full control
// ============================================================================
export {
    // Advanced MECH functions
    runMECH as runMECHAdvanced,
    getMECHTools,
    taskComplete,
    taskFatalError,
} from './mech_tools.js';

export {
    runMECHWithMemory as runMECHWithMemoryAdvanced,
} from './mech_memory_wrapper.js';

// ============================================================================
// Internal Components (for framework integration)
// ============================================================================
export {
    // Model rotation
    rotateModel,
} from './model_rotation.js';

export {
    // Meta-cognition
    spawnMetaThought,
} from './meta_cognition.js';

export {
    getMetaCognitionTools,
} from './mech_state.js';

export {
    // Thought tools
    getThoughtTools,
    getDelayAbortSignal,
} from './thought_utils.js';

// Export state type for TypeScript users
export type { MECHState, MetaFrequency, ThoughtDelay } from './types.js';

// ============================================================================
// Constants
// ============================================================================
export {
    VALID_FREQUENCIES,
    VALID_THOUGHT_DELAYS,
    DEFAULT_META_FREQUENCY,
    DEFAULT_THOUGHT_DELAY,
    DEFAULT_MODEL_SCORE,
    MAX_MODEL_SCORE,
    MIN_MODEL_SCORE,
    TASK_STATUS,
    MESSAGE_TYPES,
    AGENT_STATUS
} from './constants.js';