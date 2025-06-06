/**
 * MECH Types
 * 
 * Type definitions for the Meta-cognition Ensemble Chain-of-thought Hierarchy (MECH) system.
 * Updated to use @just-every/ensemble embed function.
 */


// ============================================================================
// Core Types
// ============================================================================


// Import and re-export types from constants
import type { MetaFrequency, ThoughtDelay } from '../utils/constants.js';
export type { MetaFrequency, ThoughtDelay };

// ============================================================================
// State Management
// ============================================================================

/**
 * State container for the MECH system
 */
export interface MECHState {
    /** Counter for LLM requests to trigger meta-cognition */
    llmRequestCount: number;

    /** How often meta-cognition should run (every N LLM requests) */
    metaFrequency: MetaFrequency;

    /** Set of model IDs that have been temporarily disabled */
    disabledModels: Set<string>;

    /** Model effectiveness scores (0-100) - higher scores mean the model is selected more often */
    modelScores: Record<string, number | Record<string, number>>;

    /** Last model used, to ensure rotation */
    lastModelUsed?: string;
}

// ============================================================================
// Agent Types
// ============================================================================

/**
 * Re-export tool and agent types from ensemble for consistency
 */
export type { ToolFunction, Agent } from '@just-every/ensemble';

