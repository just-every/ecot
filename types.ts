/**
 * MECH Types
 * 
 * Type definitions for the Meta-cognition Ensemble Chain-of-thought Hierarchy (MECH) system.
 * Updated to use @just-every/ensemble embed function.
 */

import type { 
    ProviderStreamEvent, 
    ResponseInput, 
    ResponseInputItem,
    ToolFunction,
    Agent
} from '@just-every/ensemble';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Outcome of a MECH execution
 */
export interface MechOutcome {
    status?: 'complete' | 'fatal_error';
    result?: string;
    error?: string;
    event?: ProviderStreamEvent;
}

/**
 * Result structure returned from running MECH
 */
export interface MechResult {
    status: 'complete' | 'fatal_error';
    mechOutcome?: MechOutcome;
    history: ResponseInput;
    durationSec: number;
    totalCost: number;
}

// Import and re-export types from constants
import type { MetaFrequency, ThoughtDelay } from './utils/constants.js';
export type { MetaFrequency, ThoughtDelay };

// ============================================================================
// State Management
// ============================================================================

/**
 * State container for the MECH system
 */
export interface MECHState {
    /** Counter for LLM requests to trigger meta-cognition */
    llmRequestCount: number;

    /** How often meta-cognition should run (every N LLM requests) */
    metaFrequency: MetaFrequency;

    /** Set of model IDs that have been temporarily disabled */
    disabledModels: Set<string>;

    /** Model effectiveness scores (0-100) - higher scores mean the model is selected more often */
    modelScores: Record<string, number | Record<string, number>>;

    /** Last model used, to ensure rotation */
    lastModelUsed?: string;
}

// ============================================================================
// Agent Types
// ============================================================================

/**
 * Re-export tool and agent types from ensemble for consistency
 */
export type { ToolFunction, Agent } from '@just-every/ensemble';

/**
 * Simple tool definition for the simple API
 */
export interface AgentTool {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * Communication manager interface
 */
export interface CommunicationManager {
    send: (message: unknown) => void;
    isClosed: () => boolean;
    close: () => void;
}

/**
 * Cost tracker interface (from ensemble)
 */
export interface CostTracker {
    getTotalCost: () => number;
    reset?: () => void;
}

/**
 * Memory-related parameters
 */
export interface MemoryParams {
    taskId: string;
    taskDescription: string;
    embedding?: number[];
    [key: string]: unknown;
}

/**
 * Memory item structure
 */
export interface MemoryItem {
    text: string;
    metadata?: Record<string, any>;
}

/**
 * Tool function creator (using ensemble's createToolFunction)
 */
export type CreateToolFunction = (
    fn: (...args: any[]) => any,
    description: string,
    params?: Record<string, any>,
    returnDescription?: string
) => ToolFunction;

// LLMResponse removed - MECH now uses ensemble events directly

/**
 * Complete MECH context with all required and optional fields
 * 
 * This is the full interface that MECH components expect. It provides:
 * - Core functions: history management, communication, agent execution
 * - Optional features: memory, project management, debugging
 * - Tool creation utilities for extending agent capabilities
 * 
 * Most users will use SimpleMechOptions instead, which is automatically
 * converted to MechContext by createFullContext().
 * 
 * @example
 * ```typescript
 * // Manual context creation (advanced users)
 * const context: MechContext = {
 *   sendComms: (msg) => console.log(msg),
 *   getCommunicationManager: () => commManager,
 *   addHistory: (item) => history.push(item),
 *   getHistory: () => history,
 *   costTracker: tracker,
 *   // ... other required fields
 * };
 * 
 * // Use with MECH
 * const result = await runMECH(agent, task, context);
 * ```
 */
export interface MechContext {
    // ========================================================================
    // Required Core Functions
    // ========================================================================
    
    /**
     * Send communications/status updates
     */
    sendComms: (message: unknown) => void;
    
    /**
     * Get the communication manager instance
     */
    getCommunicationManager: () => CommunicationManager;
    
    /**
     * Add an item to the conversation history
     */
    addHistory: (item: ResponseInputItem) => void;
    
    /**
     * Get the current conversation history
     */
    getHistory: () => ResponseInput;
    
    /**
     * Process any pending history threads
     */
    processPendingHistoryThreads: () => Promise<void>;
    
    /**
     * Describe history for an agent
     */
    describeHistory: (agent: Agent, messages: ResponseInput, showCount: number) => ResponseInput;
    
    /**
     * Cost tracking instance
     */
    costTracker: CostTracker;

    // ========================================================================
    // Optional Core Functions
    // ========================================================================
    
    /**
     * Send streaming events
     */
    sendStreamEvent?: (event: ProviderStreamEvent) => void;
    
    /**
     * Create a tool function
     */
    createToolFunction?: CreateToolFunction;
    
    /**
     * Format current date
     */
    dateFormat?: () => string;
    
    /**
     * Format time duration in human-readable format
     */
    readableTime?: (ms: number) => string;
    
    /**
     * Context identifier constant
     */
    MAGI_CONTEXT?: string;
    
    /**
     * Running tools tracker
     */
    runningToolTracker?: {
        listActive: () => string;
    };

    // ========================================================================
    // Memory & Advanced Features (all optional)
    // ========================================================================
    
    /**
     * Get project IDs for the current process
     */
    getProcessProjectIds?: () => string[] | null;
    
    /**
     * Plan and commit changes for a project
     */
    planAndCommitChanges?: (agent: Agent, projectId: string) => Promise<void>;
    
    /**
     * List active projects
     */
    listActiveProjects?: () => Promise<string>;
    
    /**
     * Record task start in database
     */
    recordTaskStart?: (params: MemoryParams) => Promise<string | null>;
    
    /**
     * Record task end in database
     */
    recordTaskEnd?: (params: MemoryParams) => Promise<void>;
    
    /**
     * Look up memories by embedding similarity
     */
    lookupMemoriesEmbedding?: (embedding: number[]) => Promise<MemoryItem[]>;
    
    /**
     * Format memories for display
     */
    formatMemories?: (memories: MemoryItem[]) => string;
    
    /**
     * Insert memories into database
     */
    insertMemories?: (taskId: string, memories: MemoryItem[]) => Promise<void>;
    
    
    /**
     * Register relevant custom tools based on embedding
     */
    registerRelevantCustomTools?: (embedding: number[], agent: Agent) => Promise<void>;
    
    /**
     * Quick LLM call for internal use
     */
    quick_llm_call?: (
        messages: ResponseInput,
        systemPrompt: string | null,
        config: Record<string, unknown>,
        agentId: string
    ) => Promise<string>;
}

