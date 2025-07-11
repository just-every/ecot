import { describe, it, expect, beforeEach } from 'vitest';
import {
    taskState,
    set_meta_frequency,
    set_model_score,
    getModelScore,
    disable_model,
    listDisabledModels,
    listModelScores,
    incrementLLMRequestCount,
    resetLLMRequestCount
} from '../src/state/state.js';

describe('Mind State Management', () => {
    beforeEach(() => {
        // Reset state before each test
        resetLLMRequestCount();
        set_meta_frequency('5');
        taskState.disabledModels.clear();
        // Clear model scores
        Object.keys(taskState.modelScores).forEach(key => {
            delete taskState.modelScores[key];
        });
    });

    describe('Meta-cognition frequency', () => {
        it('should set and get meta frequency', () => {
            set_meta_frequency('10');
            expect(taskState.metaFrequency).toBe(10);

            set_meta_frequency('20');
            expect(taskState.metaFrequency).toBe(20);

            set_meta_frequency('40');
            expect(taskState.metaFrequency).toBe(40);
        });

        it('should handle invalid frequency values', () => {
            expect(() => set_meta_frequency('invalid' as any)).toThrow(/Meta frequency must be one of/);
            expect(taskState.metaFrequency).toBe(5); // Should remain at default
        });

        it('should only accept valid frequencies', () => {
            const validFreqs = ['5', '10', '20', '40'];
            validFreqs.forEach(freq => {
                set_meta_frequency(freq as any);
                expect(taskState.metaFrequency).toBe(parseInt(freq));
            });
        });
    });

    describe('LLM request counting', () => {
        it('should increment request count', () => {
            expect(taskState.llmRequestCount).toBe(0);
            
            incrementLLMRequestCount();
            expect(taskState.llmRequestCount).toBe(1);
            
            incrementLLMRequestCount();
            incrementLLMRequestCount();
            expect(taskState.llmRequestCount).toBe(3);
        });

        it('should reset request count', () => {
            incrementLLMRequestCount();
            incrementLLMRequestCount();
            expect(taskState.llmRequestCount).toBe(2);
            
            resetLLMRequestCount();
            expect(taskState.llmRequestCount).toBe(0);
        });
    });

    describe('Model scoring', () => {
        it('should set and get model scores', () => {
            set_model_score('gpt-4', '85');
            expect(getModelScore('gpt-4')).toBe(85);
            
            set_model_score('claude-3', '90');
            expect(getModelScore('claude-3')).toBe(90);
        });

        it('should handle overwriting model scores', () => {
            set_model_score('gpt-4', '80');
            expect(getModelScore('gpt-4')).toBe(80);
            
            set_model_score('gpt-4', '85'); // Overwrite
            expect(getModelScore('gpt-4')).toBe(85);
        });

        it('should return default score for unknown models', () => {
            expect(getModelScore('unknown-model')).toBe(50);
        });

        it('should validate score range', () => {
            expect(() => set_model_score('gpt-4', '150')).toThrow(/Score must be a number between 0 and 100/);
            
            expect(() => set_model_score('gpt-4', '-10')).toThrow(/Score must be a number between 0 and 100/);
            
            expect(() => set_model_score('gpt-4', 'abc')).toThrow(/Score must be a number between 0 and 100/);
        });

        it('should list all model scores', () => {
            set_model_score('gpt-4', '80');
            set_model_score('claude-3', '85');
            
            const scores = listModelScores();
            expect(scores).toContain('gpt-4');
            expect(scores).toContain('claude-3');
            expect(scores).toContain('80');
            expect(scores).toContain('85');
        });
    });

    describe('Model enable/disable', () => {
        it('should disable and enable models', () => {
            expect(taskState.disabledModels.has('gpt-4')).toBe(false);
            
            disable_model('gpt-4');
            expect(taskState.disabledModels.has('gpt-4')).toBe(true);
            
            disable_model('gpt-4', false); // Enable by passing false
            expect(taskState.disabledModels.has('gpt-4')).toBe(false);
        });

        it('should handle multiple models', () => {
            disable_model('gpt-4');
            disable_model('claude-3');
            disable_model('gemini');
            
            expect(taskState.disabledModels.size).toBe(3);
            expect(taskState.disabledModels.has('gpt-4')).toBe(true);
            expect(taskState.disabledModels.has('claude-3')).toBe(true);
            expect(taskState.disabledModels.has('gemini')).toBe(true);
            
            disable_model('claude-3', false); // Enable by passing false
            expect(taskState.disabledModels.size).toBe(2);
            expect(taskState.disabledModels.has('claude-3')).toBe(false);
        });

        it('should list disabled models', () => {
            disable_model('model1');
            disable_model('model2');
            
            const list = listDisabledModels();
            expect(list).toContain('model1');
            expect(list).toContain('model2');
            expect(list).toContain('2 models disabled');
        });

        it('should handle empty disabled list', () => {
            const list = listDisabledModels();
            expect(list).toBe('No models are currently disabled.');
        });

        it('should handle duplicate operations gracefully', () => {
            disable_model('gpt-4');
            disable_model('gpt-4'); // Duplicate
            expect(taskState.disabledModels.size).toBe(1);
            
            disable_model('gpt-4', false); // Enable by passing false
            disable_model('gpt-4', false); // Already enabled
            expect(taskState.disabledModels.size).toBe(0);
        });
    });

    describe('State persistence', () => {
        it('should maintain state between operations', () => {
            // Test that state persists across operations
            set_model_score('test-model', '75');
            disable_model('disabled-model');
            
            expect(getModelScore('test-model')).toBe(75);
            expect(taskState.disabledModels.has('disabled-model')).toBe(true);
        });
    });
});