import type { ResponseInput } from '@just-every/ensemble';
import type { MetamemoryState } from '../metamemory/index.js';

export interface CognitionState {
    /** Meta-cognition frequency for this task */
    frequency?: number;

    /** Thought delay for this task */
    thoughtDelay?: number;

    /** Models disabled for this task */
    disabledModels?: Set<string>;

    /** Model scores for this task */
    modelScores?: Record<string, number>;

    /** Whether cognition is currently processing */
    processing?: boolean;
}

// JSON-serializable version of CognitionState for events
export interface SerializedCognitionState {
    /** Meta-cognition frequency for this task */
    frequency?: number;

    /** Thought delay for this task */
    thoughtDelay?: number;

    /** Models disabled for this task */
    disabledModels?: string[];

    /** Model scores for this task */
    modelScores?: Record<string, number>;

    /** Whether cognition is currently processing */
    processing?: boolean;
}

/**
 * Task-local state that is isolated per runTask invocation
 */
export interface TaskLocalState {
    /** Request counter for this task only */
    requestCount?: number;

    /** Abort controller for thought delays in this task */
    delayAbortController?: AbortController;

    /** For long running tasks which only end by being terminated */
    runIndefinitely?: boolean;

    /** Task message history */
    messages?: ResponseInput;

    cognition?: CognitionState;

    /** Metamemory for this task */
    memory?: {
        enabled?: boolean;

        /** Memory state for this task */
        state?: MetamemoryState;

        /** Whether memory is currently processing */
        processing?: boolean;
    }
}