/**
 * Proposed event format for ensemble that supports extensibility
 */

import type { StreamEventBase } from '@just-every/ensemble';

/**
 * Base task event that can be extended with additional data
 * This allows both ensemble and consuming packages to add custom data
 */
export interface TaskEventBase<TData = unknown> extends StreamEventBase {
    type: 'task_complete' | 'task_fatal_error';
    result?: string;
    /** 
     * Optional data that can be attached by the task implementation
     * This makes the event extensible without breaking changes
     */
    data?: TData;
}

/**
 * Standard task events without additional data
 */
export type TaskEvent = TaskEventBase<never>;

/**
 * Example of how Task package would extend this
 */
export interface TaskStateData {
    finalState?: {
        metaFrequency?: string;
        thoughtDelay?: string;
        disabledModels?: string[];
        modelScores?: Record<string, number>;
    };
}

export type TaskEventWithState = TaskEventBase<TaskStateData>;

// Alternative approach: Separate event types with shared base
export interface TaskCompleteEventV2<TData = unknown> extends StreamEventBase {
    type: 'task_complete';
    result: string;
    data?: TData;
}

export interface TaskFatalErrorEventV2<TData = unknown> extends StreamEventBase {
    type: 'task_fatal_error';
    error: string;  // More semantic than 'result' for errors
    code?: string;  // Error code for programmatic handling
    data?: TData;
}

// Another approach: Event with metadata
export interface TaskEventV3 extends StreamEventBase {
    type: 'task_complete' | 'task_fatal_error';
    result?: string;
    error?: string;
    /** 
     * Standard metadata that ensemble tracks
     */
    metadata?: {
        duration?: number;      // Task execution time
        model?: string;         // Model that completed the task
        tokenCount?: number;    // Tokens used
        cost?: number;         // Cost estimate
    };
    /**
     * Custom data from the implementation
     */
    customData?: Record<string, any>;
}