/**
 * Mind State management
 *
 * This module manages the state for the Mind system.
 * It provides a central state container and methods to modify the system's behavior at runtime.
 */

// Types moved from types.ts for consolidation
import type { MetaFrequency, ThoughtDelay } from '../utils/constants.js';
import { findModel } from '@just-every/ensemble';
import { DEFAULT_MODEL_SCORE, DEFAULT_META_FREQUENCY } from '../utils/constants.js';
import { validateModelScore, validateMetaFrequency } from '../utils/validation.js';
import { withErrorHandling } from '../utils/errors.js';

/**
 * State container for the Mind system
 */
export interface MindState {
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
 * Global state container for the Mind system
 * 
 * Manages meta-cognition frequency, model performance scores, and disabled models.
 * This state persists across Mind executions and influences model selection behavior.
 * Changes to this state affect all subsequent Mind operations.
 * 
 * @example
 * ```typescript
 * // Check current state
 * console.log(`LLM requests: ${mindState.llmRequestCount}`);
 * console.log(`Meta frequency: ${mindState.metaFrequency}`);
 * console.log(`Disabled models: ${mindState.disabledModels.size}`);
 * 
 * // View model scores
 * console.log(listModelScores());
 * ```
 */
export const mindState: MindState = {
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
    if (mindState.disabledModels.size === 0) {
        return 'No models are currently disabled.';
    } else {
        const models = Array.from(mindState.disabledModels);
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
    if (Object.keys(mindState.modelScores).length === 0) {
        return '- No model scores set';
    }
    
    return Object.entries(mindState.modelScores)
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
        mindState.metaFrequency = frequency as MetaFrequency;
        console.log(`[Mind] Meta-cognition frequency set to ${frequency}`);
        return mindState.metaFrequency;
    },
    'state_management'
);

// getMetaFrequency removed - only used in tests, frequency can be accessed via mindState.metaFrequency

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
        mindState.modelScores[modelId] = numericScore;
        console.log(`[Mind] Model ${modelId} score set to ${numericScore}`);
        
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
        const wasDisabled = mindState.disabledModels.has(modelId);
        mindState.disabledModels.delete(modelId);
        return wasDisabled ? `Model ${modelId} enabled` : `Model ${modelId} was not disabled`;
    }
    mindState.disabledModels.add(modelId);
    return `Model ${modelId} disabled`;
}

// enableModel function inlined into disableModel since it was only used there

/**
 * Get the score for a model
 * @param modelId - The model ID to get the score for
 * @returns The model's score (0-100)
 */
export function getModelScore(modelId: string): number {
    // First check if we have a score in mindState
    const score = mindState.modelScores[modelId];
    
    if (score !== undefined) {
        return score;
    }

    // If not in mindState, look up the model entry
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
    mindState.llmRequestCount++;
    const frequency = parseInt(mindState.metaFrequency);
    
    // Validate frequency to avoid division by zero
    if (isNaN(frequency) || frequency <= 0) {
        console.error(`[Mind] Invalid meta frequency: ${mindState.metaFrequency}. Using default.`);
        mindState.metaFrequency = DEFAULT_META_FREQUENCY;
        const defaultFreq = parseInt(DEFAULT_META_FREQUENCY);
        const shouldTriggerMeta = mindState.llmRequestCount % defaultFreq === 0;
        return {
            count: mindState.llmRequestCount,
            shouldTriggerMeta,
        };
    }
    
    const shouldTriggerMeta = mindState.llmRequestCount % frequency === 0;

    if (shouldTriggerMeta) {
        console.log(
            `[Mind] Meta-cognition trigger point reached at ${mindState.llmRequestCount} LLM requests`
        );
    }

    return {
        count: mindState.llmRequestCount,
        shouldTriggerMeta,
    };
}

/**
 * Reset the LLM request counter
 */
export function resetLLMRequestCount(): void {
    mindState.llmRequestCount = 0;
}

