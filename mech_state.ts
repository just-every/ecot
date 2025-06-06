/**
 * MECH State management
 *
 * This module manages the state for the Meta-cognition Ensemble Chain-of-thought Hierarchy (MECH) system.
 * It provides a central state container and methods to modify the system's behavior at runtime.
 */

import type { MECHState, MechContext } from './types.js';
import { ToolFunction, MODEL_CLASSES, findModel, ModelClassID } from '@just-every/ensemble';
import { VALID_FREQUENCIES, DEFAULT_MODEL_SCORE, DEFAULT_META_FREQUENCY, type MetaFrequency } from './utils/constants.js';
import { validateModelScore, validateMetaFrequency } from './utils/validation.js';
import { withErrorHandling } from './utils/errors.js';
import { globalPerformanceCache } from './utils/performance.js';

/**
 * Global state container for the MECH system
 * 
 * Manages meta-cognition frequency, model performance scores, and disabled models.
 * This state persists across MECH executions and influences model selection behavior.
 * Changes to this state affect all subsequent MECH operations.
 * 
 * @example
 * ```typescript
 * // Check current state
 * console.log(`LLM requests: ${mechState.llmRequestCount}`);
 * console.log(`Meta frequency: ${mechState.metaFrequency}`);
 * console.log(`Disabled models: ${mechState.disabledModels.size}`);
 * 
 * // View model scores
 * console.log(listModelScores());
 * ```
 */
export const mechState: MECHState = {
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
    if (mechState.disabledModels.size === 0) {
        return 'No models are currently disabled.';
    } else {
        const models = Array.from(mechState.disabledModels);
        return `${models.join('\n')}\n${models.length} models disabled`;
    }
}

/**
 * Get a formatted list of model scores for performance monitoring
 * 
 * Shows current performance scores for all models or models in a specific class.
 * Higher scores indicate better performance and increase selection probability.
 * 
 * @param modelClass - Optional model class to filter results
 * @returns Human-readable string listing model scores
 * 
 * @example
 * ```typescript
 * // All model scores
 * console.log(listModelScores());
 * 
 * // Reasoning model scores only
 * console.log(listModelScores('reasoning'));
 * ```
 */
export function listModelScores(modelClass?: ModelClassID): string {
    if (modelClass && MODEL_CLASSES[modelClass]?.models?.length > 0) {
        return MODEL_CLASSES[modelClass].models
            .map(
                modelId => `- ${modelId}: ${getModelScore(modelId, modelClass)}`
            )
            .join('\n');
    }
    if (Object.keys(mechState.modelScores).length === 0) {
        return '- No model scores set';
    }
    
    const lines: string[] = [];
    for (const [modelId, scoreData] of Object.entries(mechState.modelScores)) {
        if (typeof scoreData === 'number') {
            lines.push(`- ${modelId}: ${scoreData}`);
        } else if (typeof scoreData === 'object') {
            const classScores = Object.entries(scoreData)
                .map(([cls, score]) => `${cls}: ${score}`)
                .join(', ');
            lines.push(`- ${modelId}: ${classScores}`);
        }
    }
    return lines.join('\n');
}

/**
 * Set how often meta-cognition should run (every N LLM requests)
 * @param frequency - The frequency to set (5, 10, 20, or 40)
 * @returns The new frequency or error message
 */
export const setMetaFrequency = withErrorHandling(
    (frequency: string): string => {
        validateMetaFrequency(frequency);
        mechState.metaFrequency = frequency as MetaFrequency;
        console.log(`[MECH] Meta-cognition frequency set to ${frequency}`);
        return mechState.metaFrequency;
    },
    'state_management'
);

// getMetaFrequency removed - only used in tests, frequency can be accessed via mechState.metaFrequency

/**
 * Set the score for a specific model
 * @param modelId - The model ID to score
 * @param scoreOrClass - Score between 0-100 or model class name
 * @param modelClass - Optional model class for class-specific scores
 * @returns Success message or error
 */
export const setModelScore = withErrorHandling(
    (modelId: string, scoreOrClass: string, modelClass?: string): string => {
        // Validate inputs using validation system
        validateModelScore(modelId, scoreOrClass, modelClass);
        
        // Parse the score
        const scoreStr = modelClass ? scoreOrClass : scoreOrClass;
        const score = Number(scoreStr);
        
        // If modelClass is provided, store class-specific score
        if (modelClass) {
            if (!mechState.modelScores[modelId]) {
                mechState.modelScores[modelId] = {};
            }
            if (typeof mechState.modelScores[modelId] === 'number') {
                // Convert to object format
                const currentScore = mechState.modelScores[modelId] as number;
                mechState.modelScores[modelId] = { overall: currentScore };
            }
            
            // Type-safe assignment for class-specific scores
            const modelScoreObj = mechState.modelScores[modelId] as Record<string, number>;
            modelScoreObj[modelClass] = score;
            console.log(`[MECH] Model ${modelId} score for ${modelClass} set to ${score}`);
        } else {
            // Store overall score
            mechState.modelScores[modelId] = score;
            console.log(`[MECH] Model ${modelId} score set to ${score}`);
        }
        
        // Invalidate cache for this model
        globalPerformanceCache.invalidateModel(modelId);
        
        return `Score set to ${score}`;
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
        const wasDisabled = mechState.disabledModels.has(modelId);
        mechState.disabledModels.delete(modelId);
        return wasDisabled ? `Model ${modelId} enabled` : `Model ${modelId} was not disabled`;
    }
    mechState.disabledModels.add(modelId);
    return `Model ${modelId} disabled`;
}

// enableModel function inlined into disableModel since it was only used there

/**
 * Get the score for a model, optionally for a specific model class
 * @param modelId - The model ID to get the score for
 * @param modelClass - Optional model class to get a class-specific score
 * @returns The model's score (0-100)
 */
export function getModelScore(modelId: string, modelClass?: string): number {
    // First check if we have a score in mechState
    const scoreData = mechState.modelScores[modelId];
    
    if (scoreData !== undefined) {
        if (typeof scoreData === 'number') {
            // Simple numeric score - return it regardless of whether modelClass is specified
            return scoreData;
        } else if (typeof scoreData === 'object' && scoreData !== null) {
            // Class-specific scores
            const scoreObj = scoreData as Record<string, number>;
            if (modelClass && modelClass in scoreObj) {
                return scoreObj[modelClass];
            }
            // Return overall if exists, otherwise default
            return scoreObj.overall || DEFAULT_MODEL_SCORE;
        }
    }

    // If not in mechState, look up the model entry
    const modelEntry = findModel(modelId);

    if (modelEntry) {
        // If a specific class is requested, check if there's a class-specific score
        if (modelClass && modelEntry.scores && modelClass in modelEntry.scores) {
            return (modelEntry.scores as any)[modelClass];
        }

        // Fall back to general score if available
        if (modelEntry.score !== undefined) {
            return modelEntry.score;
        }
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
    mechState.llmRequestCount++;
    const frequency = parseInt(mechState.metaFrequency);
    
    // Validate frequency to avoid division by zero
    if (isNaN(frequency) || frequency <= 0) {
        console.error(`[MECH] Invalid meta frequency: ${mechState.metaFrequency}. Using default.`);
        mechState.metaFrequency = DEFAULT_META_FREQUENCY;
        const defaultFreq = parseInt(DEFAULT_META_FREQUENCY);
        const shouldTriggerMeta = mechState.llmRequestCount % defaultFreq === 0;
        return {
            count: mechState.llmRequestCount,
            shouldTriggerMeta,
        };
    }
    
    const shouldTriggerMeta = mechState.llmRequestCount % frequency === 0;

    if (shouldTriggerMeta) {
        console.log(
            `[MECH] Meta-cognition trigger point reached at ${mechState.llmRequestCount} LLM requests`
        );
    }

    return {
        count: mechState.llmRequestCount,
        shouldTriggerMeta,
    };
}

/**
 * Reset the LLM request counter
 */
export function resetLLMRequestCount(): void {
    mechState.llmRequestCount = 0;
}

/**
 * Create a thought that will be injected into the history
 * @param content - The thought content to inject
 * @returns Message indicating success
 */
function injectThought(content: string, context: MechContext): string {
    context.addHistory({
        type: 'message',
        role: 'developer',
        content: `**IMPORTANT - METACOGNITION:** ${content}`,
    });

    console.log(`[MECH] metacognition injected thought: ${content}`);
    return `Successfully injected metacognition thought at ${new Date().toISOString()}`;
}

function noChangesNeeded(): string {
    console.log('[MECH] metacognition no change');
    return 'No changes made';
}

/**
 * Get all metacognition tools as an array of tool definitions
 * These are available only to the metacognition agent, not the main agent
 */
export function getMetaCognitionTools(context: MechContext): ToolFunction[] {
    const tools: ToolFunction[] = [];
    
    if (context.createToolFunction) {
        // Create named functions for better debugging and testing
        function injectThoughtTool(content: string) { return injectThought(content, context); }
        function setMetaFrequencyTool(frequency: string) { return setMetaFrequency(frequency); }
        function setModelScoreTool(modelId: string, score: string) { return setModelScore(modelId, score); }
        function disableModelTool(modelId: string, disabled?: boolean) { return disableModel(modelId, disabled); }
        
        tools.push(
            context.createToolFunction(
                injectThoughtTool,
                'Your core tool for altering the thought process of the agent. Injects a thought with high priority into the next loop for the agent. The agent will see this before choosing their next thought or action.',
                {
                    content:
                        'The thought to inject. Be detailed and explain why this is important.',
                }
            ),
            context.createToolFunction(
                setMetaFrequencyTool,
                'Change how often metacognition should run (every N LLM requests)',
                {
                    frequency: {
                        // Wrap enum in a ToolParameter object
                        type: 'string',
                        description:
                            'Frequency value (5, 10, 20, or 40 LLM requests)',
                        enum: VALID_FREQUENCIES as unknown as string[],
                    },
                },
                'Confirmation message' // Added return description
            ),
            context.createToolFunction(
                setModelScoreTool,
                'Set a score for a specific model (affects selection frequency)',
                {
                    modelId: 'The model ID to score',
                    score: 'Score between 0-100, higher means the model is selected more often',
                },
                'The new score for the model' // Added return description
            ),
            context.createToolFunction(
                disableModelTool,
                'Temporarily disable a model from being selected. Pass disabled=false to enable it again.',
                {
                    modelId: 'The model ID to change',
                    disabled: {
                        type: 'boolean',
                        description:
                            'Whether to disable the model (true) or enable it (false)',
                        optional: true,
                        default: true,
                    },
                }
            ),
            context.createToolFunction(
                noChangesNeeded,
                'Everything is perfect. Use when no other tools are needed.'
            ),
        );
    }
    
    return tools;
}