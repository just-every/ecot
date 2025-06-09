/**
 * Task State management
 *
 * This module manages the state for the Task system.
 * It provides a central state container and methods to modify the system's behavior at runtime.
 */

// Types moved from types.ts for consolidation
import type { MetaFrequency, ThoughtDelay } from '../utils/constants.js';
import { findModel } from '@just-every/ensemble';
import { DEFAULT_MODEL_SCORE, DEFAULT_META_FREQUENCY } from '../utils/constants.js';
import { validateModelScore, validateMetaFrequency } from '../utils/validation.js';
import { withErrorHandling } from '../utils/errors.js';

/**
 * State container for the Task system
 */
export interface TaskState {
    /** Counter for LLM requests to trigger meta-cognition */
    llmRequestCount: number;

    /** How often meta-cognition should run (every N LLM requests) */
    metaFrequency: MetaFrequency;

    /** Set of model IDs that have been temporarily disabled */
    disabledModels: Set<string>;

    /** Model effectiveness scores (0-100) - higher scores mean the model is selected more often */
    modelScores: Record<string, number>;
}

// Re-export types for external use
export type { MetaFrequency, ThoughtDelay };
export type { ToolFunction, Agent } from '@just-every/ensemble';

/**
 * Global state container for the Task system
 * 
 * Manages meta-cognition frequency, model performance scores, and disabled models.
 * This state persists across Task executions and influences model selection behavior.
 * Changes to this state affect all subsequent Task operations.
 * 
 * @example
 * ```typescript
 * // Check current state
 * console.log(`LLM requests: ${taskState.llmRequestCount}`);
 * console.log(`Meta frequency: ${taskState.metaFrequency}`);
 * console.log(`Disabled models: ${taskState.disabledModels.size}`);
 * 
 * // View model scores
 * console.log(listModelScores());
 * ```
 */
export const taskState: TaskState = {
    llmRequestCount: 0,
    metaFrequency: DEFAULT_META_FREQUENCY,
    disabledModels: new Set<string>(),
    modelScores: {},
};

/**
 * Get a formatted list of currently disabled models
 * 
 * Provides a human-readable summary of which models are currently
 * excluded from the rotation algorithm. Useful for debugging
 * model selection issues.
 * 
 * @returns Human-readable string listing disabled models or "No models disabled"
 * 
 * @example
 * ```typescript
 * console.log(listDisabledModels());
 * // Output: "gpt-4\nclaude-3\n2 models disabled"
 * ```
 */
export function listDisabledModels(): string {
    if (taskState.disabledModels.size === 0) {
        return 'No models are currently disabled.';
    } else {
        const models = Array.from(taskState.disabledModels);
        return `${models.join('\n')}\n${models.length} models disabled`;
    }
}

/**
 * Get a formatted list of model scores for performance monitoring
 * 
 * Shows current performance scores for all models.
 * Higher scores indicate better performance and increase selection probability.
 * 
 * @returns Human-readable string listing model scores
 * 
 * @example
 * ```typescript
 * console.log(listModelScores());
 * // Output: "- gpt-4: 85\n- claude-3: 90"
 * ```
 */
export function listModelScores(): string {
    if (Object.keys(taskState.modelScores).length === 0) {
        return '- No model scores set';
    }
    
    return Object.entries(taskState.modelScores)
        .map(([modelId, score]) => `- ${modelId}: ${score}`)
        .join('\n');
}

/**
 * Set how often meta-cognition should run (every N LLM requests)
 * @param frequency - The frequency to set (5, 10, 20, or 40)
 * @returns The new frequency or error message
 */
export const setMetaFrequency = withErrorHandling(
    (frequency: string): string => {
        validateMetaFrequency(frequency);
        taskState.metaFrequency = frequency as MetaFrequency;
        console.log(`[Task] Meta-cognition frequency set to ${frequency}`);
        return taskState.metaFrequency;
    },
    'state_management'
);

// getMetaFrequency removed - only used in tests, frequency can be accessed via taskState.metaFrequency

/**
 * Set the score for a specific model
 * @param modelId - The model ID to score
 * @param score - Score between 0-100
 * @returns Success message or error
 */
export const setModelScore = withErrorHandling(
    (modelId: string, score: string): string => {
        // Validate inputs using validation system
        validateModelScore(modelId, score);
        
        // Parse and store the score
        const numericScore = Number(score);
        taskState.modelScores[modelId] = numericScore;
        console.log(`[Task] Model ${modelId} score set to ${numericScore}`);
        
        return `Score set to ${numericScore}`;
    },
    'state_management'
);

/**
 * Disable a model so it won't be selected
 * @param modelId - The model ID to disable
 * @param disabled - Optional boolean to enable/disable (default: true)
 * @returns Status message
 */
export function disableModel(modelId: string, disabled?: boolean): string {
    if (!modelId || typeof modelId !== 'string') {
        return `Invalid modelId: ${modelId}. Must be a non-empty string.`;
    }
    
    if (disabled === false) {
        // Inline enableModel functionality
        const wasDisabled = taskState.disabledModels.has(modelId);
        taskState.disabledModels.delete(modelId);
        return wasDisabled ? `Model ${modelId} enabled` : `Model ${modelId} was not disabled`;
    }
    taskState.disabledModels.add(modelId);
    return `Model ${modelId} disabled`;
}

// enableModel function inlined into disableModel since it was only used there

/**
 * Get the score for a model
 * @param modelId - The model ID to get the score for
 * @returns The model's score (0-100)
 */
export function getModelScore(modelId: string): number {
    // First check if we have a score in taskState
    const score = taskState.modelScores[modelId];
    
    if (score !== undefined) {
        return score;
    }

    // If not in taskState, look up the model entry
    const modelEntry = findModel(modelId);

    if (modelEntry?.score !== undefined) {
        return modelEntry.score;
    }

    // Default score
    return DEFAULT_MODEL_SCORE;
}

/**
 * Increment the LLM request counter
 * @returns The new count and whether meta-cognition should trigger
 */
export function incrementLLMRequestCount(): {
    count: number;
    shouldTriggerMeta: boolean;
} {
    taskState.llmRequestCount++;
    const frequency = parseInt(taskState.metaFrequency);
    
    // Validate frequency to avoid division by zero
    if (isNaN(frequency) || frequency <= 0) {
        console.error(`[Task] Invalid meta frequency: ${taskState.metaFrequency}. Using default.`);
        taskState.metaFrequency = DEFAULT_META_FREQUENCY;
        const defaultFreq = parseInt(DEFAULT_META_FREQUENCY);
        const shouldTriggerMeta = taskState.llmRequestCount % defaultFreq === 0;
        return {
            count: taskState.llmRequestCount,
            shouldTriggerMeta,
        };
    }
    
    const shouldTriggerMeta = taskState.llmRequestCount % frequency === 0;

    if (shouldTriggerMeta) {
        console.log(
            `[Task] Meta-cognition trigger point reached at ${taskState.llmRequestCount} LLM requests`
        );
    }

    return {
        count: taskState.llmRequestCount,
        shouldTriggerMeta,
    };
}

/**
 * Reset the LLM request counter
 */
export function resetLLMRequestCount(): void {
    taskState.llmRequestCount = 0;
}

