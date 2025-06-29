/**
 * Task event types that match what ensemble should have
 * Once ensemble is updated, we can import these from there
 */

import type { StreamEventBase, ResponseInput } from '@just-every/ensemble';

/**
 * Task completion/error event with full state for resumability
 */
export interface TaskEvent extends StreamEventBase {
    type: 'task_complete' | 'task_fatal_error';
    result: string;
    finalState: {
        metaFrequency: string;
        thoughtDelay: string;
        disabledModels: string[];
        modelScores: Record<string, number>;
        messages: ResponseInput;
    };
}

// For now, create separate types for easier handling
export interface TaskCompleteEvent extends TaskEvent {
    type: 'task_complete';
}

export interface TaskFatalErrorEvent extends TaskEvent {
    type: 'task_fatal_error';
}