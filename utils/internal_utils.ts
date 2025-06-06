/**
 * Internal utilities for MECH
 * 
 * These utilities are moved from magi to make MECH more self-contained
 */

import type { ResponseInput, ResponseInputItem } from '@just-every/ensemble';
import { CostTracker, createToolFunction } from '@just-every/ensemble';
import type { 
    MechContext, 
    CommunicationManager
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

// Helper functions removed - functionality inlined in createSimpleContext()

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
        processPendingHistoryThreads: async () => {}, // No-op
        describeHistory: (_agent, messages, showCount) => messages.slice(-showCount),
        costTracker: globalCostTracker,
        
        // Optional functions with defaults (inlined)
        createToolFunction: (fn, description, params, returnDescription) => {
            const executableFn = async (...args: any[]) => {
                const result = await fn(...args);
                return typeof result === 'string' ? result : JSON.stringify(result);
            };
            return createToolFunction(executableFn, description, params, returnDescription, fn.name || 'anonymous');
        },
        dateFormat: () => new Date().toISOString(),
        readableTime: (ms) => {
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            
            if (hours > 0) return `${hours}h ${minutes % 60}m`;
            if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
            return `${seconds}s`;
        },
        MAGI_CONTEXT: 'MECH Context'
    };
}

