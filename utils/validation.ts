/**
 * MECH Validation System
 * 
 * Comprehensive input validation with helpful error messages
 */

import { MechValidationError } from './errors.js';
import type { MechAgent, SimpleMechOptions } from '../types.js';

/**
 * Validate a MECH agent object
 */
export function validateAgent(agent: unknown): asserts agent is MechAgent {
    if (!agent || typeof agent !== 'object') {
        throw new MechValidationError(
            'Agent must be a valid object with at least a "name" property',
            {
                metadata: { 
                    receivedType: typeof agent, 
                    receivedValue: agent,
                    expectedType: 'object with { name: string, ...otherProps }'
                }
            }
        );
    }
    
    if (!('name' in agent) || typeof agent.name !== 'string' || !agent.name.trim()) {
        throw new MechValidationError(
            'Agent must have a non-empty string "name" property',
            {
                metadata: { 
                    hasName: 'name' in agent,
                    nameType: 'name' in agent ? typeof agent.name : 'missing',
                    nameValue: 'name' in agent ? agent.name : undefined,
                    expectedName: 'non-empty string'
                }
            }
        );
    }

    // Optional property validations with helpful messages
    if ('agent_id' in agent && typeof agent.agent_id !== 'string') {
        throw new MechValidationError(
            'Agent "agent_id" must be a string if provided',
            {
                agentName: agent.name,
                metadata: { 
                    agentIdType: typeof agent.agent_id,
                    agentIdValue: agent.agent_id
                }
            }
        );
    }

    if ('modelClass' in agent && agent.modelClass !== undefined) {
        const validClasses = ['reasoning', 'standard', 'code', 'metacognition'];
        if (typeof agent.modelClass !== 'string' || !validClasses.includes(agent.modelClass)) {
            throw new MechValidationError(
                `Agent "modelClass" must be one of: ${validClasses.join(', ')}`,
                {
                    agentName: agent.name,
                    metadata: { 
                        receivedModelClass: agent.modelClass,
                        validModelClasses: validClasses
                    }
                }
            );
        }
    }

    if ('instructions' in agent && agent.instructions !== undefined && typeof agent.instructions !== 'string') {
        throw new MechValidationError(
            'Agent "instructions" must be a string if provided',
            {
                agentName: agent.name,
                metadata: { 
                    instructionsType: typeof agent.instructions
                }
            }
        );
    }
}

/**
 * Validate task string
 */
export function validateTask(task: unknown): asserts task is string {
    if (typeof task !== 'string') {
        throw new MechValidationError(
            'Task must be a non-empty string',
            {
                metadata: { 
                    taskType: typeof task,
                    taskValue: task,
                    expectedType: 'string'
                }
            }
        );
    }

    if (!task.trim()) {
        throw new MechValidationError(
            'Task cannot be empty or only whitespace',
            {
                metadata: { 
                    taskLength: task.length,
                    taskValue: task
                }
            }
        );
    }

    if (task.length > 10000) {
        throw new MechValidationError(
            'Task is too long (maximum 10,000 characters)',
            {
                metadata: { 
                    taskLength: task.length,
                    maxLength: 10000
                }
            }
        );
    }
}

/**
 * Validate runAgent function
 */
export function validateRunAgent(runAgent: unknown): asserts runAgent is SimpleMechOptions['runAgent'] {
    if (typeof runAgent !== 'function') {
        throw new MechValidationError(
            'runAgent must be a function that accepts (agent, input, history) and returns Promise<{response, tool_calls}>',
            {
                metadata: { 
                    runAgentType: typeof runAgent,
                    expectedSignature: '(agent: MechAgent, input: string, history: ResponseInput) => Promise<LLMResponse>'
                }
            }
        );
    }

    // Check function parameter count (should accept 3 parameters)
    if (runAgent.length < 3) {
        throw new MechValidationError(
            'runAgent function should accept 3 parameters: (agent, input, history)',
            {
                metadata: { 
                    actualParameterCount: runAgent.length,
                    expectedParameterCount: 3,
                    expectedSignature: '(agent: MechAgent, input: string, history: ResponseInput) => Promise<LLMResponse>'
                }
            }
        );
    }
}

/**
 * Validate SimpleMechOptions
 */
export function validateSimpleMechOptions(options: unknown): asserts options is SimpleMechOptions {
    if (!options || typeof options !== 'object') {
        throw new MechValidationError(
            'Options must be a valid object',
            {
                metadata: { 
                    optionsType: typeof options,
                    expectedType: 'SimpleMechOptions object'
                }
            }
        );
    }

    const opts = options as any;

    // Validate required properties
    if (!('agent' in opts)) {
        throw new MechValidationError(
            'Options must include an "agent" property',
            {
                metadata: { 
                    providedKeys: Object.keys(opts),
                    missingRequired: 'agent'
                }
            }
        );
    }

    if (!('task' in opts)) {
        throw new MechValidationError(
            'Options must include a "task" property',
            {
                metadata: { 
                    providedKeys: Object.keys(opts),
                    missingRequired: 'task'
                }
            }
        );
    }

    if (!('runAgent' in opts)) {
        throw new MechValidationError(
            'Options must include a "runAgent" property',
            {
                metadata: { 
                    providedKeys: Object.keys(opts),
                    missingRequired: 'runAgent'
                }
            }
        );
    }

    // Validate each property
    validateAgent(opts.agent);
    validateTask(opts.task);
    validateRunAgent(opts.runAgent);

    // Validate optional callbacks
    if ('onHistory' in opts && opts.onHistory !== undefined) {
        if (typeof opts.onHistory !== 'function') {
            throw new MechValidationError(
                'onHistory callback must be a function if provided',
                {
                    metadata: { 
                        onHistoryType: typeof opts.onHistory,
                        expectedType: 'function'
                    }
                }
            );
        }
    }

    if ('onStatus' in opts && opts.onStatus !== undefined) {
        if (typeof opts.onStatus !== 'function') {
            throw new MechValidationError(
                'onStatus callback must be a function if provided',
                {
                    metadata: { 
                        onStatusType: typeof opts.onStatus,
                        expectedType: 'function'
                    }
                }
            );
        }
    }
}


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
    const validDelays = ['0', '1', '2', '4', '8', '16', '32', '64', '128'];
    
    if (typeof delay !== 'string' || !validDelays.includes(delay)) {
        throw new MechValidationError(
            `Thought delay must be one of: ${validDelays.join(', ')} (seconds)`,
            {
                metadata: { 
                    delayValue: delay,
                    delayType: typeof delay,
                    validDelays: validDelays
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

/**
 * Validate that a string contains no sensitive information
 */
export function validateNoSensitiveData(content: string): void {
    const sensitivePatterns = [
        /api[_-]?key/i,
        /password/i,
        /secret/i,
        /token/i,
        /bearer\s+[a-zA-Z0-9]/i,
        /\b[A-Za-z0-9]{40,}\b/, // Long tokens
        /-----BEGIN[\s\S]*?-----END/i // Certificate/key blocks
    ];
    
    for (const pattern of sensitivePatterns) {
        if (pattern.test(content)) {
            throw new MechValidationError(
                'Content appears to contain sensitive information (API keys, passwords, etc.)',
                {
                    metadata: { 
                        contentLength: content.length,
                        detectedPattern: pattern.toString(),
                        suggestion: 'Remove sensitive data before processing'
                    }
                }
            );
        }
    }
}