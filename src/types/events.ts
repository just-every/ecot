/**
 * Task event types extending ensemble's TaskEvent
 * Since ensemble has optional fields, we create stricter types here
 */

import type { TaskEvent as EnsembleTaskEvent, ResponseInput } from '@just-every/ensemble';

/**
 * Task's stricter version of TaskEvent with required finalState
 */
export interface TaskEvent extends EnsembleTaskEvent {
    finalState: {
        metaFrequency: string;
        thoughtDelay: string;
        disabledModels: string[];
        modelScores: Record<string, number>;
        messages: ResponseInput;
    };
}

// Specific event types for easier handling
export interface TaskCompleteEvent extends TaskEvent {
    type: 'task_complete';
}

export interface TaskFatalErrorEvent extends TaskEvent {
    type: 'task_fatal_error';
}