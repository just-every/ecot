/**
 * MECH Error Handling System
 * 
 * Provides structured error handling for better debugging and user experience
 */

export type MechErrorComponent = 
    | 'validation'
    | 'state_management'
    | 'thought_management';

export interface MechErrorContext {
    /** Component where the error occurred */
    component: MechErrorComponent;
    /** Agent name if applicable */
    agentName?: string;
    /** Model ID if applicable */
    modelId?: string;
    /** Task description if applicable */
    task?: string;
    /** Additional context data */
    metadata?: Record<string, any>;
}

/**
 * Structured error class for MECH system
 */
export class MechError extends Error {
    public readonly component: MechErrorComponent;
    public readonly agentName?: string;
    public readonly modelId?: string;
    public readonly task?: string;
    public readonly metadata?: Record<string, any>;
    public readonly originalError?: Error;
    public readonly timestamp: Date;

    constructor(
        message: string,
        context: MechErrorContext,
        originalError?: Error
    ) {
        const fullMessage = `[MECH:${context.component}] ${message}`;
        super(fullMessage);
        
        this.name = 'MechError';
        this.component = context.component;
        this.agentName = context.agentName;
        this.modelId = context.modelId;
        this.task = context.task;
        this.metadata = context.metadata;
        this.originalError = originalError;
        this.timestamp = new Date();

        // Maintain stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, MechError);
        }
    }

    // Unused methods removed - getUserMessage, getSuggestions, toJSON
    // These were not used anywhere in the codebase
}

/**
 * Validation error - thrown when input validation fails
 */
export class MechValidationError extends MechError {
    constructor(
        message: string,
        context: Omit<MechErrorContext, 'component'>,
        originalError?: Error
    ) {
        super(message, { ...context, component: 'validation' }, originalError);
        this.name = 'MechValidationError';
    }
}

// Specialized error classes and validation functions removed
// Only MechError and MechValidationError are used in the simplified API

/**
 * Utility to wrap functions with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => any>(
    fn: T,
    component: MechErrorComponent,
    context?: Partial<MechErrorContext>
): T {
    return ((...args: Parameters<T>) => {
        try {
            const result = fn(...args);
            
            // Handle async functions
            if (result instanceof Promise) {
                return result.catch((error: any) => {
                    throw new MechError(
                        `Async operation failed: ${error.message || String(error)}`,
                        { component, ...context },
                        error instanceof Error ? error : new Error(String(error))
                    );
                });
            }
            
            return result;
        } catch (error: any) {
            throw new MechError(
                `Operation failed: ${error.message || String(error)}`,
                { component, ...context },
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }) as T;
}