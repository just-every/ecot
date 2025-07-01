import type { MetamemoryState } from '../metamemory/types.js';

/**
 * Task-local state that is isolated per runTask invocation
 */
export interface TaskLocalState {
    /** Request counter for this task only */
    requestCount: number;
    
    /** Meta-cognition frequency for this task */
    metaFrequency: string;
    
    /** Thought delay for this task */
    thoughtDelay: string;
    
    /** Models disabled for this task */
    disabledModels: Set<string>;
    
    /** Model scores for this task */
    modelScores: Record<string, number>;
    
    /** Abort controller for thought delays in this task */
    delayAbortController: AbortController;
    
    /** Metamemory state for this task */
    metamemoryState?: MetamemoryState;
    
    /** Whether metamemory is enabled for this task */
    metamemoryEnabled: boolean;
    
    /** Whether metamemory is currently processing */
    metamemoryProcessing: boolean;
}