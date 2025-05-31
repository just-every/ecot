/**
 * Internal utilities for MECH
 * 
 * These utilities are moved from magi to make MECH more self-contained
 */

import type { ResponseInput, ResponseInputItem } from '@just-every/ensemble';
import { CostTracker } from '@just-every/ensemble';
import type { 
    MechContext, 
    SimpleMechOptions,
    MechAgent,
    CreateToolFunction,
    ToolFunction,
    CommunicationManager,
    MemoryItem
} from '../types.js';
import type { ToolParameter } from '@just-every/ensemble';

/**
 * Default history management implementation
 */
export function createDefaultHistory() {
    // Create a new history array for each instance to avoid shared state
    let history: ResponseInput = [];
    
    return {
        addHistory: (item: ResponseInputItem) => {
            history.push(item);
        },
        getHistory: () => history,
        clearHistory: () => {
            history = [];
        }
    };
}

/**
 * Default date formatting
 */
export function defaultDateFormat(): string {
    return new Date().toISOString();
}

/**
 * Default readable time formatting
 */
export function defaultReadableTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

/**
 * Default tool function creator
 */
export const defaultCreateToolFunction: CreateToolFunction = (
    fn: (...args: any[]) => any,
    description: string,
    params?: Record<string, any>,
    _returnDescription?: string
): ToolFunction => {
    // Wrap the function to ensure it returns a string
    const executableFn = async (...args: any[]) => {
        const result = await fn(...args);
        return typeof result === 'string' ? result : JSON.stringify(result);
    };
    
    // Convert simple params to ToolParameter format
    const properties: Record<string, ToolParameter> = {};
    if (params) {
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'string') {
                properties[key] = { description: value };
            } else if (typeof value === 'object' && value !== null) {
                properties[key] = value as ToolParameter;
            } else {
                properties[key] = { description: String(value) };
            }
        }
    }
    
    return {
        function: executableFn,
        definition: {
            type: 'function',
            function: {
                name: fn.name || 'anonymous',
                description,
                parameters: {
                    type: 'object',
                    properties,
                    required: Object.keys(properties)
                }
            }
        }
    };
};

/**
 * Default communication manager
 */
export function createDefaultCommunicationManager(): CommunicationManager {
    let closed = false;
    return {
        send: (message: any) => console.log('[MECH]', message),
        isClosed: () => closed,
        close: () => { closed = true; }
    };
}

/**
 * Default history description
 */
export function defaultDescribeHistory(
    _agent: MechAgent,
    messages: ResponseInput,
    showCount: number
): ResponseInput {
    // For the default implementation, we just return the messages as-is
    // This function is typically overridden by the context provider
    return messages.slice(-showCount);
}

/**
 * Default process pending history threads (no-op)
 */
export async function defaultProcessPendingHistoryThreads(): Promise<void> {
    // No-op by default
}

/**
 * Default memory formatter
 */
export function defaultFormatMemories(memories: MemoryItem[]): string {
    return memories.map(m => `- ${m.text}`).join('\n');
}

// Global cost tracker instance
export const globalCostTracker = new CostTracker();

/**
 * Convert a simple context to a full MechContext
 * This provides all the defaults and adapters needed
 */
export function createFullContext(options: SimpleMechOptions): MechContext {
    const historyManager = createDefaultHistory();
    const commManager = createDefaultCommunicationManager();
    
    // Build the full context with defaults
    const fullContext: MechContext = {
        // ========================================================================
        // Required Core Functions
        // ========================================================================
        sendComms: (msg) => {
            console.log('[MECH Status]', msg);
            if (typeof msg === 'object' && msg !== null && 'type' in msg) {
                options.onStatus?.(msg as { type: string; [key: string]: any });
            }
        },
        getCommunicationManager: () => commManager,
        addHistory: (item) => {
            historyManager.addHistory(item);
            options.onHistory?.(item);
        },
        getHistory: historyManager.getHistory,
        processPendingHistoryThreads: defaultProcessPendingHistoryThreads,
        describeHistory: defaultDescribeHistory,
        costTracker: globalCostTracker,
        
        // ========================================================================
        // Optional Core Functions (with defaults)
        // ========================================================================
        createToolFunction: defaultCreateToolFunction,
        dateFormat: defaultDateFormat,
        readableTime: defaultReadableTime,
        MAGI_CONTEXT: 'MECH System Context',
        
        // ========================================================================
        // Memory Features (only if provided)
        // ========================================================================
        ...(options.lookupMemories && { 
            lookupMemoriesEmbedding: options.lookupMemories 
        }),
        ...(options.saveMemory && { 
            insertMemories: options.saveMemory 
        }),
        formatMemories: defaultFormatMemories,
    };
    
    return fullContext;
}