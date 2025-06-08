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