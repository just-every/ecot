/**
 * Mind Error Handling System
 * 
 * Provides structured error handling for better debugging and user experience
 */

export type MindErrorComponent = 
    | 'validation'
    | 'state_management'
    | 'thought_management';

export interface MindErrorContext {
    /** Component where the error occurred */
    component: MindErrorComponent;
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
 * Structured error class for Mind system
 */
export class MindError extends Error {
    public readonly component: MindErrorComponent;
    public readonly agentName?: string;
    public readonly modelId?: string;
    public readonly task?: string;
    public readonly metadata?: Record<string, any>;
    public readonly originalError?: Error;
    public readonly timestamp: Date;

    constructor(
        message: string,
        context: MindErrorContext,
        originalError?: Error
    ) {
        const fullMessage = `[Mind:${context.component}] ${message}`;
        super(fullMessage);
        
        this.name = 'MindError';
        this.component = context.component;
        this.agentName = context.agentName;
        this.modelId = context.modelId;
        this.task = context.task;
        this.metadata = context.metadata;
        this.originalError = originalError;
        this.timestamp = new Date();

        // Maintain stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, MindError);
        }
    }

    // Unused methods removed - getUserMessage, getSuggestions, toJSON
    // These were not used anywhere in the codebase
}

/**
 * Validation error - thrown when input validation fails
 */
export class MindValidationError extends MindError {
    constructor(
        message: string,
        context: Omit<MindErrorContext, 'component'>,
        originalError?: Error
    ) {
        super(message, { ...context, component: 'validation' }, originalError);
        this.name = 'MindValidationError';
    }
}

// Specialized error classes and validation functions removed
// Only MindError and MindValidationError are used in the simplified API

/**
 * Utility to wrap functions with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => any>(
    fn: T,
    component: MindErrorComponent,
    context?: Partial<MindErrorContext>
): T {
    return ((...args: Parameters<T>) => {
        try {
            const result = fn(...args);
            
            // Handle async functions
            if (result instanceof Promise) {
                return result.catch((error: any) => {
                    throw new MindError(
                        `Async operation failed: ${error.message || String(error)}`,
                        { component, ...context },
                        error instanceof Error ? error : new Error(String(error))
                    );
                });
            }
            
            return result;
        } catch (error: any) {
            throw new MindError(
                `Operation failed: ${error.message || String(error)}`,
                { component, ...context },
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }) as T;
}