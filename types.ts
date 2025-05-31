/**
 * MECH Types
 * 
 * Type definitions for the Meta-cognition Ensemble Chain-of-thought Hierarchy (MECH) system.
 * Updated to use @just-every/ensemble embed function.
 */

import type { 
    EnsembleStreamEvent, 
    ResponseInput, 
    ResponseInputItem,
    ToolFunction
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
    event?: EnsembleStreamEvent;
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
 * Re-export tool types from ensemble for consistency
 */
export type { ToolFunction } from '@just-every/ensemble';

/**
 * Simple tool definition for the simple API
 */
export interface AgentTool {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
}

/**
 * Agent interface required by MECH
 * This is a subset of the full Agent class to minimize dependencies
 */
export interface MechAgent {
    name: string;
    agent_id: string;
    model?: string;
    modelClass?: string;
    tools?: ToolFunction[];
    instructions?: string;
    historyThread?: ResponseInputItem[];
    args?: Record<string, any>;
    export(): Record<string, any>;
    getTools(): Promise<ToolFunction[]>;
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
 * Tool function creator
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
    describeHistory: (agent: MechAgent, messages: ResponseInput, showCount: number) => ResponseInput;
    
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
    sendStreamEvent?: (event: EnsembleStreamEvent) => void;
    
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
    planAndCommitChanges?: (agent: MechAgent, projectId: string) => Promise<void>;
    
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
    registerRelevantCustomTools?: (embedding: number[], agent: MechAgent) => Promise<void>;
    
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

// ============================================================================
// Simple API Types
// ============================================================================

/**
 * Minimal context for the simple API
 * Only the truly required fields for basic operation
 */
export interface SimpleMechOptions {
    /**
     * Optional callback when history items are added
     */
    onHistory?: (item: ResponseInputItem) => void;
    
    /**
     * Optional callback for status updates
     */
    onStatus?: (status: { type: string; [key: string]: unknown }) => void;
    
    /**
     * Optional memory functions
     */
    lookupMemories?: (embedding: number[]) => Promise<MemoryItem[]>;
    saveMemory?: (taskId: string, memories: MemoryItem[]) => Promise<void>;
}

/**
 * Simple agent definition for the easy API
 */
export interface SimpleAgent {
    name?: string;              // Optional: defaults to "Agent"
    agent_id?: string;
    model?: string;
    modelClass?: string;        // Recommended: "reasoning", "standard", "code", "metacognition"
    tools?: ToolFunction[];     // Functional tools that can be executed
    instructions?: string;
}

/**
 * Options for running MECH with the simple API
 */
export interface RunMechOptions extends SimpleMechOptions {
    agent: SimpleAgent;
    task: string;
    loop?: boolean;                   // Default: true (enable multi-turn conversation)
    
    /** Optional: Function to lookup memories by embedding */
    lookupMemories?: (embedding: number[]) => Promise<MemoryItem[]>;
    
    /** Optional: Function to save memories */
    saveMemory?: (taskId: string, memories: MemoryItem[]) => Promise<void>;
}


// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for MECH
 */
export interface MechConfig {
    /** Initial meta-cognition frequency */
    initialMetaFrequency?: MetaFrequency;
    
    /** Initial thought delay in seconds */
    initialThoughtDelay?: ThoughtDelay;
    
    /** Whether to enable memory features */
    enableMemory?: boolean;
}