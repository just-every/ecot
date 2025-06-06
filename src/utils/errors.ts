/**
 * MECH Error Handling System
 * 
 * Provides structured error handling for better debugging and user experience
 */

export type MechErrorComponent = 
    | 'validation'
    | 'model_rotation'
    | 'meta_cognition'
    | 'thought_management'
    | 'state_management'
    | 'simple_api'
    | 'memory'
    | 'tools'
    | 'communication'
    | 'internal';

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

    /**
     * Get a user-friendly error message with suggestions
     */
    getUserMessage(): string {
        const suggestions = this.getSuggestions();
        let message = this.message;
        
        if (suggestions.length > 0) {
            message += '\n\nSuggestions:\n' + suggestions.map(s => `- ${s}`).join('\n');
        }
        
        return message;
    }

    /**
     * Get contextual suggestions based on error type
     */
    private getSuggestions(): string[] {
        const suggestions: string[] = [];
        
        switch (this.component) {
            case 'validation':
                suggestions.push('Check that all required parameters are provided');
                suggestions.push('Ensure parameter types match the expected interface');
                break;
                
            case 'model_rotation':
                suggestions.push('Verify that model classes are properly configured');
                suggestions.push('Check if any models are disabled or unavailable');
                suggestions.push('Ensure @just-every/ensemble is properly installed');
                break;
                
            case 'meta_cognition':
                suggestions.push('Check meta-cognition frequency settings');
                suggestions.push('Verify that model rotation is working correctly');
                break;
                
            case 'memory':
                suggestions.push('Ensure embedding function is provided and working');
                suggestions.push('Check memory lookup and storage functions');
                break;
                
            case 'simple_api':
                suggestions.push('Verify runAgent function signature and return type');
                suggestions.push('Check that agent has required properties (name)');
                break;
                
            default:
                suggestions.push('Check the MECH documentation for troubleshooting');
                break;
        }
        
        return suggestions;
    }

    /**
     * Convert error to structured object for logging
     */
    toJSON(): Record<string, any> {
        return {
            name: this.name,
            message: this.message,
            component: this.component,
            agentName: this.agentName,
            modelId: this.modelId,
            task: this.task,
            metadata: this.metadata,
            timestamp: this.timestamp.toISOString(),
            originalError: this.originalError ? {
                name: this.originalError.name,
                message: this.originalError.message,
                stack: this.originalError.stack
            } : undefined,
            stack: this.stack
        };
    }
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