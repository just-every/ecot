/**
 * MECH Validation System
 * 
 * Comprehensive input validation with helpful error messages
 */

import { MechValidationError } from './errors.js';
import { VALID_THOUGHT_DELAYS } from './constants.js';
// Agent and task validation removed - MECH now uses ensemble agents directly
// and handles validation internally in the simplified API


/**
 * Validate model score input
 */
export function validateModelScore(modelId: unknown, score: unknown): void {
    if (!modelId || typeof modelId !== 'string' || !modelId.trim()) {
        throw new MechValidationError(
            'Model ID must be a non-empty string',
            {
                metadata: { 
                    modelIdType: typeof modelId,
                    modelIdValue: modelId
                }
            }
        );
    }

    const scoreNum = Number(score);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
        throw new MechValidationError(
            'Score must be a number between 0 and 100',
            {
                modelId,
                metadata: { 
                    scoreValue: score,
                    scoreType: typeof score,
                    scoreNumber: scoreNum,
                    validRange: '0-100'
                }
            }
        );
    }
}

/**
 * Validate meta frequency input
 */
export function validateMetaFrequency(frequency: unknown): void {
    const validFrequencies = ['5', '10', '20', '40'];
    
    if (typeof frequency !== 'string' || !validFrequencies.includes(frequency)) {
        throw new MechValidationError(
            `Meta frequency must be one of: ${validFrequencies.join(', ')}`,
            {
                metadata: { 
                    frequencyValue: frequency,
                    frequencyType: typeof frequency,
                    validFrequencies: validFrequencies
                }
            }
        );
    }
}

/**
 * Validate thought delay input
 */
export function validateThoughtDelay(delay: unknown): void {
    if (typeof delay !== 'string' || !VALID_THOUGHT_DELAYS.includes(delay as any)) {
        throw new MechValidationError(
            `Thought delay must be one of: ${VALID_THOUGHT_DELAYS.join(', ')} (seconds)`,
            {
                metadata: { 
                    delayValue: delay,
                    delayType: typeof delay,
                    validDelays: VALID_THOUGHT_DELAYS
                }
            }
        );
    }
}

// Sensitive data validation removed - not currently used in simplified API
// Could be re-added if security scanning is needed in the future