/**
 * Global test setup for Mind tests
 */

import { vi, beforeAll } from 'vitest';
import { taskState, set_model_score } from '../src/state/state.js';

// Setup global mocks before all tests
beforeAll(() => {
    // Initialize model scores for test models
    set_model_score('gpt-4', '80');
    set_model_score('o1-preview', '85');
    set_model_score('claude-3-5-sonnet-20241022', '90');
    set_model_score('gemini-1.5-pro', '75');
    set_model_score('grok-beta', '70');
    set_model_score('gpt-4o-mini', '60');
    
    // Clear disabled models
    taskState.disabledModels.clear();
});

// Export common mocks
export const mockEnsemble = {
    MODEL_CLASSES: {
        standard: ['gpt-4', 'claude-3-5-sonnet-20241022', 'gemini-1.5-pro'],
        coding: ['grok-beta', 'claude-3-5-sonnet-20241022', 'gpt-4o'],
        reasoning: ['o1-preview', 'o1-mini', 'claude-3-5-sonnet-20241022'],
        creative: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'gemini-1.5-pro'],
        speed: ['gpt-4o-mini', 'claude-3-5-haiku-20241022', 'gemini-1.5-flash']
    },
    getModelFromClass: vi.fn((modelClass: string) => {
        const models: Record<string, string> = {
            standard: 'gpt-4',
            coding: 'grok-beta',
            reasoning: 'o1-preview',
            creative: 'claude-3-5-sonnet-20241022',
            speed: 'gpt-4o-mini'
        };
        return models[modelClass] || models.standard;
    })
};