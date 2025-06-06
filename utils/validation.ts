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
export function validateModelScore(modelId: unknown, score: unknown, modelClass?: unknown): void {
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

    if (modelClass !== undefined) {
        const validClasses = ['reasoning', 'standard', 'code', 'metacognition'];
        if (typeof modelClass !== 'string' || !validClasses.includes(modelClass)) {
            throw new MechValidationError(
                `Model class must be one of: ${validClasses.join(', ')}`,
                {
                    modelId,
                    metadata: { 
                        modelClassValue: modelClass,
                        modelClassType: typeof modelClass,
                        validModelClasses: validClasses
                    }
                }
            );
        }
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

/**
 * Sanitize text input for security
 */
export function sanitizeTextInput(input: string, maxLength: number = 10000): string {
    if (typeof input !== 'string') {
        throw new MechValidationError(
            'Input must be a string',
            {
                metadata: { 
                    inputType: typeof input,
                    expectedType: 'string'
                }
            }
        );
    }

    // Remove potentially dangerous patterns
    let sanitized = input
        .replace(/[<>]/g, '') // Remove HTML-like tags
        .replace(/javascript:/gi, '') // Remove javascript: URLs
        .replace(/data:/gi, '') // Remove data: URLs
        .replace(/vbscript:/gi, '') // Remove vbscript: URLs
        .trim();

    // Limit length
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
}

// Sensitive data validation removed - not currently used in simplified API
// Could be re-added if security scanning is needed in the future