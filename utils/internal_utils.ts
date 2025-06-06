/**
 * Internal utilities for MECH
 * 
 * These utilities are moved from magi to make MECH more self-contained
 */

import type { ResponseInput, ResponseInputItem } from '@just-every/ensemble';
import { CostTracker, createToolFunction } from '@just-every/ensemble';
import type { 
    MechContext, 
    Agent,
    ToolFunction,
    CommunicationManager,
    MemoryItem
} from '../types.js';

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
 * Note: This wrapper is no longer needed with ensemble v0.1.27's ToolBuilder API
 * Keeping for backward compatibility but should be deprecated
 */
export function wrapEnsembleCreateToolFunction(
    fn: (...args: any[]) => any,
    description: string,
    params?: Record<string, any>,
    _returnDescription?: string
): ToolFunction {
    // Wrap the function to ensure it returns a string
    const executableFn = async (...args: any[]) => {
        const result = await fn(...args);
        return typeof result === 'string' ? result : JSON.stringify(result);
    };
    
    // Convert simple params to ensemble's ToolParameterMap format
    const paramMap: Record<string, any> = {};
    if (params) {
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'string') {
                paramMap[key] = value; // Simple string description
            } else {
                paramMap[key] = value; // Pass through more complex parameter objects
            }
        }
    }
    
    return createToolFunction(
        executableFn,
        description,
        paramMap,
        _returnDescription,
        fn.name || 'anonymous'
    );
}

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
    _agent: Agent,
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
 * Create a minimal context for the simplified API
 * Everything is automatic - no configuration needed
 */
export function createSimpleContext(): MechContext {
    const historyManager = createDefaultHistory();
    let closed = false;
    
    const commManager: CommunicationManager = {
        send: (message: any) => {
            console.log('[MECH]', message);
        },
        isClosed: () => closed,
        close: () => { closed = true; }
    };
    
    return {
        // Core functions
        sendComms: (msg) => console.log('[MECH Status]', msg),
        getCommunicationManager: () => commManager,
        addHistory: historyManager.addHistory,
        getHistory: historyManager.getHistory,
        processPendingHistoryThreads: defaultProcessPendingHistoryThreads,
        describeHistory: defaultDescribeHistory,
        costTracker: globalCostTracker,
        
        // Optional functions with defaults
        createToolFunction: wrapEnsembleCreateToolFunction,
        dateFormat: () => new Date().toISOString(),
        readableTime: defaultReadableTime,
        MAGI_CONTEXT: 'MECH Context'
    };
}

