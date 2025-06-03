/**
 * Model rotation logic for MECH
 * 
 * This module handles the weighted model selection based on MECH scores.
 */

import { MODEL_CLASSES, ModelClassID, getModelFromClass } from '@just-every/ensemble';
import { mechState, getModelScore } from './mech_state.js';
import type { MechAgent } from './types.js';
import { globalPerformanceCache } from './utils/performance.js';
// MechModelError available if needed for error handling
import { debugModelSelection, debugTrace } from './utils/debug.js';

/**
 * Intelligent model selection using hierarchical scoring and rotation
 * 
 * This function implements the core model rotation logic for MECH:
 * 1. Attempts to use getModelFromClass() for direct model selection
 * 2. Falls back to weighted random selection based on model scores
 * 3. Filters out disabled models and ensures rotation (avoids consecutive use)
 * 4. Uses performance caching for efficiency
 * 
 * Higher model scores increase selection probability. Models with score 0 are
 * rarely selected, while models with score 100 are heavily favored.
 * 
 * @param agent - The agent needing a model assignment
 * @param modelClass - Optional specific model class to use (e.g., 'reasoning', 'coding')
 * @returns Selected model ID or undefined if no suitable model found
 * 
 * @example
 * ```typescript
 * // Basic rotation with default model class
 * const model = await rotateModel(agent);
 * 
 * // Force specific model class for reasoning tasks
 * const reasoningModel = await rotateModel(agent, 'reasoning');
 * 
 * // Check if model was selected
 * if (model) {
 *   agent.model = model;
 * } else {
 *   console.warn('No suitable model available');
 * }
 * ```
 */
export async function rotateModel(
    agent: MechAgent,
    modelClass?: ModelClassID
): Promise<string | undefined> {
    // Validate agent first
    if (!agent || typeof agent !== 'object') {
        throw new TypeError('Invalid agent: must be a valid MechAgent object');
    }
    
    debugTrace('model_rotation', 'start', { agentName: agent.name, modelClass });
    
    // If agent already has a specific model, use it
    if (agent.model) {
        debugTrace('model_rotation', 'end', { selectedModel: agent.model, reason: 'pre-specified' });
        mechState.lastModelUsed = agent.model;
        return agent.model;
    }
    
    // Use the global lastModelUsed for rotation, not the agent's model
    const lastModel = mechState.lastModelUsed;
    let model: string | undefined;
    let selectionReason = 'unknown';

    modelClass = modelClass || (agent.modelClass as ModelClassID);
    if (modelClass) {
        // First try to get a model using getModelFromClass which respects overrides
        try {
            model = await getModelFromClass(modelClass);
            selectionReason = 'getModelFromClass';
            console.log(`[MECH] Model selected via getModelFromClass for class ${modelClass}: ${model}`);
            
            debugModelSelection(agent, [], model, {}, 0, selectionReason);
            debugTrace('model_rotation', 'end', { selectedModel: model, reason: selectionReason });
            return model;
        } catch (error) {
            console.log(`[MECH] getModelFromClass failed for ${modelClass}, falling back to rotation logic`);
            selectionReason = 'rotation_fallback';
        }
            
            // Fallback to original rotation logic if getModelFromClass fails
            const modelClassStr = modelClass as string;

        if (modelClassStr in MODEL_CLASSES) {
            // Safe to use the key since we've verified it exists
            const modelClassConfig =
                MODEL_CLASSES[modelClassStr as keyof typeof MODEL_CLASSES];
            let models: string[] = [...modelClassConfig.models];

            // Filter out models
            models = models.filter(modelId => {
                // Skip last used model to ensure rotation
                if (modelId === lastModel) return false;

                // Skip disabled models
                if (mechState.disabledModels.has(modelId)) return false;

                return true;
            });

            // If no models available after filtering, return undefined
            if (models.length === 0) {
                console.warn(`[MECH] No models available for class ${modelClassStr} after filtering`);
                return undefined;
            }

            if (models.length > 0) {
                // Use cached weighted selection based on model scores
                const totalScore = globalPerformanceCache.getCachedWeightedTotal(
                    models,
                    modelClassStr as ModelClassID,
                    () => models.reduce((sum, modelId) => {
                        const score = globalPerformanceCache.getCachedScore(
                            modelId,
                            modelClassStr as ModelClassID,
                            () => getModelScore(modelId, modelClassStr)
                        );
                        return sum + Math.max(0, score || 0);
                    }, 0)
                );

                if (totalScore > 0) {
                    // Collect scores for debugging
                    const scores: Record<string, number> = {};
                    for (const modelId of models) {
                        scores[modelId] = globalPerformanceCache.getCachedScore(
                            modelId,
                            modelClassStr as ModelClassID,
                            () => getModelScore(modelId, modelClassStr)
                        );
                    }
                    
                    selectionReason = 'weighted_random';
                    
                    // Weighted random selection with cached scores
                    let rand = Math.random() * totalScore;
                    for (const modelId of models) {
                        const score = scores[modelId];
                        rand -= Math.max(0, score || 0);
                        if (rand <= 0) {
                            model = modelId;
                            break;
                        }
                    }
                    
                    debugModelSelection(agent, models, model, scores, totalScore, selectionReason);

                    // Fallback in case rounding errors cause us to miss
                    if (!model) {
                        model = models[models.length - 1];
                    }
                } else {
                    // If all scores are 0 for some reason, pick a random model
                    const randomIndex = Math.floor(Math.random() * models.length);
                    model = models[randomIndex];
                }
            }
        } else {
            // If modelClass isn't a valid key, fall back to 'standard'
            console.warn(
                `Invalid model class '${modelClassStr}', falling back to standard models`
            );
            if ('standard' in MODEL_CLASSES) {
                const standardModels =
                    MODEL_CLASSES['standard' as keyof typeof MODEL_CLASSES]
                        .models;
                if (standardModels.length > 0) {
                    model = standardModels[0];
                }
            }
        }
    }
    
    // Final validation
    if (!model) {
        console.warn('[MECH] No model could be selected through rotation');
        selectionReason = 'no_model_available';
    }

    debugTrace('model_rotation', 'end', { selectedModel: model, reason: selectionReason });
    return model;
}