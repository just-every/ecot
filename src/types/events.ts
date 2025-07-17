/**
 * Task event types extending ensemble's TaskEvent
 * Since ensemble has optional fields, we create stricter types here
 */

import type { TaskEvent as EnsembleTaskEvent } from '@just-every/ensemble';
import type { TaskLocalState, SerializedCognitionState } from './task-state.js';
import type { SerializedMetamemoryState } from '../metamemory/types/index.js';

/**
 * Task's stricter version of TaskEvent with required finalState
 */
export interface TaskEvent extends EnsembleTaskEvent {
    finalState: TaskLocalState;
    task_id: string;
}

// Specific event types for easier handling
export interface TaskStartEvent extends TaskEvent {
    type: 'task_start';
}

export interface TaskCompleteEvent extends TaskEvent {
    type: 'task_complete';
}

export interface TaskFatalErrorEvent extends TaskEvent {
    type: 'task_fatal_error';
}

/**
 * MetaMemory event for tracking metamemory operations
 */
export interface MetaMemoryEvent {
    type: 'metamemory_event';
    operation: 'tagging_start' | 'tagging_complete';
    eventId: string; // Unique ID for the event
    data: {
        processingTime?: number;
        messageCount?: number;
        state?: SerializedMetamemoryState;

        newTopicCount?: number;
        updatedTopicCount?: number;
        newMessageCount?: number;
        updatedMessageCount?: number;
    };
    timestamp: number;
}

/**
 * MetaCognition event for tracking metacognition operations
 */
export interface MetaCognitionEvent {
    type: 'metacognition_event';
    operation: 'analysis_start' | 'analysis_complete';
    eventId: string; // Unique ID for the event
    data: {
        requestCount?: number;
        processingTime?: number;
        state?: SerializedCognitionState;

        adjustments?: string[];
        injectedThoughts?: string[];
    };
    timestamp: number;
}