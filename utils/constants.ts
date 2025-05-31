/**
 * Shared constants for the MECH system
 */

/**
 * Valid meta-cognition frequency values
 */
export const VALID_FREQUENCIES = ['5', '10', '20', '40'] as const;
export type MetaFrequency = typeof VALID_FREQUENCIES[number];

/**
 * Valid thought delay values in seconds
 */
export const VALID_THOUGHT_DELAYS = ['0', '2', '4', '8', '16', '32', '64', '128'] as const;
export type ThoughtDelay = typeof VALID_THOUGHT_DELAYS[number];

/**
 * Default values
 */
export const DEFAULT_META_FREQUENCY: MetaFrequency = '5';
export const DEFAULT_THOUGHT_DELAY: ThoughtDelay = '0';
export const DEFAULT_MODEL_SCORE = 50;

/**
 * Limits
 */
export const MAX_MODEL_SCORE = 100;
export const MIN_MODEL_SCORE = 0;

/**
 * Status types
 */
export const TASK_STATUS = {
    COMPLETE: 'complete',
    FATAL_ERROR: 'fatal_error'
} as const;

/**
 * Message types
 */
export const MESSAGE_TYPES = {
    THOUGHT_DELAY: 'thought_delay',
    THOUGHT_COMPLETE: 'thought_complete',
    META_COGNITION_TRIGGERED: 'meta_cognition_triggered',
    AGENT_STATUS: 'agent_status',
    PROCESS_UPDATED: 'process_updated',
    ERROR: 'error'
} as const;

/**
 * Agent status types
 */
export const AGENT_STATUS = {
    MECH_START: 'mech_start',
    MECH_DONE: 'mech_done',
    THOUGHT_DELAY: 'thought_delay'
} as const;