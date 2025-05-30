/**
 * MECH State management
 *
 * This module manages the state for the Meta-cognition Ensemble Chain-of-thought Hierarchy (MECH) system.
 * It provides a central state container and methods to modify the system's behavior at runtime.
 */

import type { MECHState, MechContext } from './types.js';
import { ToolFunction, MODEL_CLASSES, findModel, ModelClassID } from '@just-every/ensemble';
import { VALID_FREQUENCIES, DEFAULT_MODEL_SCORE, MIN_MODEL_SCORE, MAX_MODEL_SCORE, DEFAULT_META_FREQUENCY, type MetaFrequency } from './constants.js';

/**
 * Global MECH state
 */
export const mechState: MECHState = {
    llmRequestCount: 0,
    metaFrequency: DEFAULT_META_FREQUENCY,
    disabledModels: new Set<string>(),
    modelScores: {},
};

export function listDisabledModels(): string {
    if (mechState.disabledModels.size === 0) {
        return 'No models are currently disabled.';
    } else {
        const models = Array.from(mechState.disabledModels);
        return `${models.join('\n')}\n${models.length} models disabled`;
    }
}

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
export function setMetaFrequency(frequency: string): string {
    if (VALID_FREQUENCIES.includes(frequency as MetaFrequency)) {
        mechState.metaFrequency = frequency as MetaFrequency;
        return mechState.metaFrequency;
    }
    return `Invalid frequency: ${frequency}. Valid values are: ${VALID_FREQUENCIES.join(', ')}`;
}

/**
 * Get the current meta-cognition frequency
 * @returns The current frequency
 */
export function getMetaFrequency(): string {
    return mechState.metaFrequency;
}

/**
 * Set the score for a specific model
 * @param modelId - The model ID to score
 * @param scoreOrClass - Score between 0-100 or model class name
 * @param modelClass - Optional model class for class-specific scores
 * @returns Success message or error
 */
export function setModelScore(modelId: string, scoreOrClass: string, modelClass?: string): string {
    // Validate inputs
    if (!modelId || typeof modelId !== 'string') {
        return `Invalid modelId: ${modelId}. Must be a non-empty string.`;
    }
    
    // Parse the score
    const scoreStr = modelClass ? scoreOrClass : scoreOrClass;
    const score = Number(scoreStr);
    
    // Validate the score
    if (isNaN(score) || score < MIN_MODEL_SCORE || score > MAX_MODEL_SCORE) {
        return `Invalid score: ${scoreStr}. Score must be between ${MIN_MODEL_SCORE} and ${MAX_MODEL_SCORE}.`;
    }
    
    // If modelClass is provided, store class-specific score
    if (modelClass) {
        if (!mechState.modelScores[modelId]) {
            mechState.modelScores[modelId] = {};
        }
        if (typeof mechState.modelScores[modelId] === 'number') {
            // Convert to object format
            mechState.modelScores[modelId] = { overall: mechState.modelScores[modelId] as number };
        }
        (mechState.modelScores[modelId] as any)[modelClass] = score;
        console.log(`[MECH] Model ${modelId} score for ${modelClass} set to ${score}`);
    } else {
        // Store overall score
        mechState.modelScores[modelId] = score;
        console.log(`[MECH] Model ${modelId} score set to ${score}`);
    }
    
    return `Score set to ${score}`;
}

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
        return enableModel(modelId);
    }
    mechState.disabledModels.add(modelId);
    return `Model ${modelId} disabled`;
}

/**
 * Enable a previously disabled model
 * @param modelId - The model ID to enable
 * @returns Status message
 */
export function enableModel(modelId: string): string {
    if (!modelId || typeof modelId !== 'string') {
        return `Invalid modelId: ${modelId}. Must be a non-empty string.`;
    }
    
    const wasDisabled = mechState.disabledModels.has(modelId);
    mechState.disabledModels.delete(modelId);
    return wasDisabled ? `Model ${modelId} enabled` : `Model ${modelId} was not disabled`;
}

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
            // Simple numeric score
            return modelClass ? 50 : scoreData; // Return default if class requested but only overall exists
        } else if (typeof scoreData === 'object') {
            // Class-specific scores
            if (modelClass && modelClass in scoreData) {
                return (scoreData as any)[modelClass];
            }
            // Return overall if exists, otherwise default
            return (scoreData as any).overall || DEFAULT_MODEL_SCORE;
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