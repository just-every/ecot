/**
 * MECH Debug and Logging System
 * 
 * Enhanced debugging capabilities for development and troubleshooting
 */

import type { MechAgent } from '../types.js';
import { globalPerformanceCache } from './performance.js';

/**
 * Debug configuration
 */
export interface MechDebugConfig {
    /** Enable debug mode */
    enabled: boolean;
    
    /** Log level */
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    
    /** Trace execution flow */
    traceExecution: boolean;
    
    /** Save decision history */
    saveDecisionHistory: boolean;
    
    /** Log performance metrics */
    logPerformance: boolean;
    
    /** Log model selection details */
    logModelSelection: boolean;
    
    /** Log validation details */
    logValidation: boolean;
    
    /** Maximum history items to keep */
    maxHistoryItems: number;
}

/**
 * Debug session data
 */
interface DebugSession {
    sessionId: string;
    startTime: Date;
    executionTrace: DebugTraceEntry[];
    modelSelections: ModelSelectionEntry[];
    performanceMetrics: PerformanceMetric[];
    validationEvents: ValidationEvent[];
}

/**
 * Execution trace entry
 */
interface DebugTraceEntry {
    timestamp: Date;
    component: string;
    operation: string;
    input?: any;
    output?: any;
    duration?: number;
    error?: Error;
}

/**
 * Model selection entry
 */
interface ModelSelectionEntry {
    timestamp: Date;
    agentName: string;
    modelClass?: string;
    availableModels: string[];
    selectedModel?: string;
    scores: Record<string, number>;
    totalScore: number;
    selectionReason: string;
}

/**
 * Performance metric
 */
interface PerformanceMetric {
    timestamp: Date;
    operation: string;
    duration: number;
    cacheHit?: boolean;
    metadata?: Record<string, any>;
}

/**
 * Validation event
 */
interface ValidationEvent {
    timestamp: Date;
    type: 'success' | 'warning' | 'error';
    component: string;
    message: string;
    input?: any;
    suggestions?: string[];
}

/**
 * Default debug configuration
 */
const DEFAULT_DEBUG_CONFIG: MechDebugConfig = {
    enabled: false,
    logLevel: 'info',
    traceExecution: false,
    saveDecisionHistory: false,
    logPerformance: false,
    logModelSelection: false,
    logValidation: false,
    maxHistoryItems: 1000
};

/**
 * Global debug state
 */
class MechDebugger {
    private config: MechDebugConfig = { ...DEFAULT_DEBUG_CONFIG };
    private sessions = new Map<string, DebugSession>();
    private currentSessionId: string | null = null;

    constructor() {
        // Check environment variables for debug configuration
        this.loadFromEnvironment();
    }

    /**
     * Load debug configuration from environment variables
     */
    private loadFromEnvironment(): void {
        if (process.env.MECH_DEBUG === 'true') {
            this.config.enabled = true;
        }

        if (process.env.MECH_LOG_LEVEL) {
            const level = process.env.MECH_LOG_LEVEL.toLowerCase();
            if (['debug', 'info', 'warn', 'error'].includes(level)) {
                this.config.logLevel = level as MechDebugConfig['logLevel'];
            }
        }

        if (process.env.MECH_TRACE === 'true') {
            this.config.traceExecution = true;
        }

        if (process.env.MECH_PERFORMANCE === 'true') {
            this.config.logPerformance = true;
        }

        if (process.env.MECH_MODEL_SELECTION === 'true') {
            this.config.logModelSelection = true;
        }
    }

    /**
     * Update debug configuration
     */
    configure(updates: Partial<MechDebugConfig>): void {
        this.config = { ...this.config, ...updates };
        
        if (this.config.enabled) {
            this.log('info', 'Debug mode enabled', { config: this.config });
        }
    }

    /**
     * Start a new debug session
     */
    startSession(sessionId?: string): string {
        const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const session: DebugSession = {
            sessionId: id,
            startTime: new Date(),
            executionTrace: [],
            modelSelections: [],
            performanceMetrics: [],
            validationEvents: []
        };

        this.sessions.set(id, session);
        this.currentSessionId = id;

        this.log('info', 'Debug session started', { sessionId: id });
        return id;
    }

    /**
     * End the current debug session
     */
    endSession(): DebugSession | null {
        if (!this.currentSessionId) return null;

        const session = this.sessions.get(this.currentSessionId);
        if (session) {
            this.log('info', 'Debug session ended', {
                sessionId: this.currentSessionId,
                duration: Date.now() - session.startTime.getTime(),
                traceEntries: session.executionTrace.length,
                modelSelections: session.modelSelections.length
            });
        }

        this.currentSessionId = null;
        return session || null;
    }

    /**
     * Log a message with appropriate level
     */
    log(level: MechDebugConfig['logLevel'], message: string, data?: any): void {
        if (!this.config.enabled) return;

        const levelPriority = { debug: 0, info: 1, warn: 2, error: 3 };
        const configPriority = levelPriority[this.config.logLevel];
        const messagePriority = levelPriority[level];

        if (messagePriority < configPriority) return;

        // Log entry data is used directly in console output

        // Use appropriate console method
        const consoleMethod = level === 'error' ? console.error :
                            level === 'warn' ? console.warn :
                            level === 'debug' ? console.debug :
                            console.log;

        consoleMethod(`[MECH:${level.toUpperCase()}]`, message, data || '');
    }

    /**
     * Add execution trace entry
     */
    trace(component: string, operation: string, input?: any, output?: any, duration?: number, error?: Error): void {
        if (!this.config.enabled || !this.config.traceExecution || !this.currentSessionId) return;

        const session = this.sessions.get(this.currentSessionId);
        if (!session) return;

        const entry: DebugTraceEntry = {
            timestamp: new Date(),
            component,
            operation,
            input,
            output,
            duration,
            error
        };

        session.executionTrace.push(entry);

        // Keep history within limits
        if (session.executionTrace.length > this.config.maxHistoryItems) {
            session.executionTrace.splice(0, session.executionTrace.length - this.config.maxHistoryItems);
        }

        this.log('debug', `Trace: ${component}.${operation}`, {
            duration: duration ? `${duration}ms` : undefined,
            hasInput: !!input,
            hasOutput: !!output,
            error: error?.message
        });
    }

    /**
     * Log model selection
     */
    logModelSelection(
        agent: MechAgent,
        availableModels: string[],
        selectedModel: string | undefined,
        scores: Record<string, number>,
        totalScore: number,
        reason: string
    ): void {
        if (!this.config.enabled || !this.config.logModelSelection) return;

        const entry: ModelSelectionEntry = {
            timestamp: new Date(),
            agentName: agent.name || 'Agent',
            modelClass: agent.modelClass,
            availableModels,
            selectedModel,
            scores,
            totalScore,
            selectionReason: reason
        };

        if (this.currentSessionId) {
            const session = this.sessions.get(this.currentSessionId);
            if (session) {
                session.modelSelections.push(entry);
            }
        }

        this.log('info', `Model selection for ${agent.name}`, {
            modelClass: agent.modelClass,
            selectedModel,
            availableCount: availableModels.length,
            totalScore,
            reason
        });
    }

    /**
     * Log performance metric
     */
    logPerformance(operation: string, duration: number, cacheHit?: boolean, metadata?: Record<string, any>): void {
        if (!this.config.enabled || !this.config.logPerformance) return;

        const entry: PerformanceMetric = {
            timestamp: new Date(),
            operation,
            duration,
            cacheHit,
            metadata
        };

        if (this.currentSessionId) {
            const session = this.sessions.get(this.currentSessionId);
            if (session) {
                session.performanceMetrics.push(entry);
            }
        }

        this.log('debug', `Performance: ${operation}`, {
            duration: `${duration}ms`,
            cacheHit,
            metadata
        });
    }

    /**
     * Log validation event
     */
    logValidation(
        type: 'success' | 'warning' | 'error',
        component: string,
        message: string,
        input?: any,
        suggestions?: string[]
    ): void {
        if (!this.config.enabled || !this.config.logValidation) return;

        const entry: ValidationEvent = {
            timestamp: new Date(),
            type,
            component,
            message,
            input,
            suggestions
        };

        if (this.currentSessionId) {
            const session = this.sessions.get(this.currentSessionId);
            if (session) {
                session.validationEvents.push(entry);
            }
        }

        const logLevel = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'debug';
        this.log(logLevel, `Validation ${type}: ${message}`, {
            component,
            suggestions: suggestions?.join(', ')
        });
    }

    /**
     * Get current debug configuration
     */
    getConfig(): Readonly<MechDebugConfig> {
        return { ...this.config };
    }

    /**
     * Get debug session data
     */
    getSession(sessionId?: string): DebugSession | null {
        const id = sessionId || this.currentSessionId;
        return id ? this.sessions.get(id) || null : null;
    }

    /**
     * Get all sessions
     */
    getAllSessions(): DebugSession[] {
        return Array.from(this.sessions.values());
    }

    /**
     * Clear session data
     */
    clearSessions(): void {
        this.sessions.clear();
        this.currentSessionId = null;
        this.log('info', 'All debug sessions cleared');
    }

    /**
     * Export debug data for analysis
     */
    exportDebugData(sessionId?: string): string {
        const session = this.getSession(sessionId);
        if (!session) {
            throw new Error('No session data available for export');
        }

        // Add performance cache stats
        const cacheStats = globalPerformanceCache.getStats();

        const debugData = {
            session,
            performanceCache: cacheStats,
            config: this.config,
            exportedAt: new Date().toISOString()
        };

        return JSON.stringify(debugData, null, 2);
    }

    /**
     * Generate debug summary
     */
    generateSummary(sessionId?: string): string {
        const session = this.getSession(sessionId);
        if (!session) {
            return 'No session data available';
        }

        const duration = Date.now() - session.startTime.getTime();
        const errorCount = session.validationEvents.filter(e => e.type === 'error').length;
        const warningCount = session.validationEvents.filter(e => e.type === 'warning').length;

        const avgModelSelectionTime = session.modelSelections.length > 0 ?
            session.performanceMetrics
                .filter(m => m.operation.includes('model_selection'))
                .reduce((sum, m) => sum + m.duration, 0) / session.modelSelections.length : 0;

        return `
MECH Debug Summary
==================
Session ID: ${session.sessionId}
Duration: ${duration}ms
Execution Trace Entries: ${session.executionTrace.length}
Model Selections: ${session.modelSelections.length}
Performance Metrics: ${session.performanceMetrics.length}
Validation Events: ${session.validationEvents.length} (${errorCount} errors, ${warningCount} warnings)
Average Model Selection Time: ${avgModelSelectionTime.toFixed(2)}ms

Cache Statistics:
${JSON.stringify(globalPerformanceCache.getStats(), null, 2)}
        `.trim();
    }
}

/**
 * Global debugger instance
 */
export const globalDebugger = new MechDebugger();

/**
 * Convenience functions for debugging
 */
export const setDebugMode = (enabled: boolean): void => {
    globalDebugger.configure({ enabled });
};

export const setLogLevel = (level: MechDebugConfig['logLevel']): void => {
    globalDebugger.configure({ logLevel: level });
};

export const enableTracing = (enabled: boolean = true): void => {
    globalDebugger.configure({ traceExecution: enabled });
};

export const enablePerformanceLogging = (enabled: boolean = true): void => {
    globalDebugger.configure({ logPerformance: enabled });
};

export const debugLog = globalDebugger.log.bind(globalDebugger);
export const debugTrace = globalDebugger.trace.bind(globalDebugger);
export const debugModelSelection = globalDebugger.logModelSelection.bind(globalDebugger);
export const debugPerformance = globalDebugger.logPerformance.bind(globalDebugger);
export const debugValidation = globalDebugger.logValidation.bind(globalDebugger);

/**
 * Decorator for automatic function tracing
 */
export function traced(component: string) {
    return function <T extends (...args: any[]) => any>(
        _target: any,
        propertyKey: string,
        descriptor: TypedPropertyDescriptor<T>
    ): TypedPropertyDescriptor<T> {
        const originalMethod = descriptor.value;
        if (!originalMethod) return descriptor;

        descriptor.value = (async function (this: any, ...args: any[]) {
            const startTime = Date.now();
            let result: any;
            let error: Error | undefined;

            try {
                result = await originalMethod.apply(this, args);
                return result;
            } catch (e) {
                error = e instanceof Error ? e : new Error(String(e));
                throw error;
            } finally {
                const duration = Date.now() - startTime;
                debugTrace(component, propertyKey, args, result, duration, error);
            }
        }) as any;

        return descriptor;
    };
}

/**
 * Helper to measure and log performance
 */
export async function measurePerformance<T>(
    operation: string,
    fn: () => Promise<T> | T,
    metadata?: Record<string, any>
): Promise<T> {
    const startTime = Date.now();
    let result: T;
    
    try {
        result = await fn();
        return result;
    } finally {
        const duration = Date.now() - startTime;
        debugPerformance(operation, duration, false, metadata);
    }
}

/**
 * Export debug types for external use
 */
export type {
    DebugTraceEntry,
    ModelSelectionEntry,
    PerformanceMetric,
    ValidationEvent
};