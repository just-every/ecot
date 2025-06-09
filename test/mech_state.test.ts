import { describe, it, expect, beforeEach } from 'vitest';
import {
    taskState,
    setMetaFrequency,
    setModelScore,
    getModelScore,
    disableModel,
    listDisabledModels,
    listModelScores,
    incrementLLMRequestCount,
    resetLLMRequestCount
} from '../src/state/state.js';

describe('Mind State Management', () => {
    beforeEach(() => {
        // Reset state before each test
        resetLLMRequestCount();
        setMetaFrequency('5');
        taskState.disabledModels.clear();
        // Clear model scores
        Object.keys(taskState.modelScores).forEach(key => {
            delete taskState.modelScores[key];
        });
    });

    describe('Meta-cognition frequency', () => {
        it('should set and get meta frequency', () => {
            setMetaFrequency('10');
            expect(taskState.metaFrequency).toBe('10');

            setMetaFrequency('20');
            expect(taskState.metaFrequency).toBe('20');

            setMetaFrequency('40');
            expect(taskState.metaFrequency).toBe('40');
        });

        it('should handle invalid frequency values', () => {
            expect(() => setMetaFrequency('invalid' as any)).toThrow(/Meta frequency must be one of/);
            expect(taskState.metaFrequency).toBe('5'); // Should remain at default
        });

        it('should only accept valid frequencies', () => {
            const validFreqs = ['5', '10', '20', '40'];
            validFreqs.forEach(freq => {
                setMetaFrequency(freq as any);
                expect(taskState.metaFrequency).toBe(freq);
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
            setModelScore('gpt-4', '85');
            expect(getModelScore('gpt-4')).toBe(85);
            
            setModelScore('claude-3', '90');
            expect(getModelScore('claude-3')).toBe(90);
        });

        it('should handle overwriting model scores', () => {
            setModelScore('gpt-4', '80');
            expect(getModelScore('gpt-4')).toBe(80);
            
            setModelScore('gpt-4', '85'); // Overwrite
            expect(getModelScore('gpt-4')).toBe(85);
        });

        it('should return default score for unknown models', () => {
            expect(getModelScore('unknown-model')).toBe(50);
        });

        it('should validate score range', () => {
            expect(() => setModelScore('gpt-4', '150')).toThrow(/Score must be a number between 0 and 100/);
            
            expect(() => setModelScore('gpt-4', '-10')).toThrow(/Score must be a number between 0 and 100/);
            
            expect(() => setModelScore('gpt-4', 'abc')).toThrow(/Score must be a number between 0 and 100/);
        });

        it('should list all model scores', () => {
            setModelScore('gpt-4', '80');
            setModelScore('claude-3', '85');
            
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
            
            disableModel('gpt-4');
            expect(taskState.disabledModels.has('gpt-4')).toBe(true);
            
            disableModel('gpt-4', false); // Enable by passing false
            expect(taskState.disabledModels.has('gpt-4')).toBe(false);
        });

        it('should handle multiple models', () => {
            disableModel('gpt-4');
            disableModel('claude-3');
            disableModel('gemini');
            
            expect(taskState.disabledModels.size).toBe(3);
            expect(taskState.disabledModels.has('gpt-4')).toBe(true);
            expect(taskState.disabledModels.has('claude-3')).toBe(true);
            expect(taskState.disabledModels.has('gemini')).toBe(true);
            
            disableModel('claude-3', false); // Enable by passing false
            expect(taskState.disabledModels.size).toBe(2);
            expect(taskState.disabledModels.has('claude-3')).toBe(false);
        });

        it('should list disabled models', () => {
            disableModel('model1');
            disableModel('model2');
            
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
            disableModel('gpt-4');
            disableModel('gpt-4'); // Duplicate
            expect(taskState.disabledModels.size).toBe(1);
            
            disableModel('gpt-4', false); // Enable by passing false
            disableModel('gpt-4', false); // Already enabled
            expect(taskState.disabledModels.size).toBe(0);
        });
    });

    describe('State persistence', () => {
        it('should maintain state between operations', () => {
            // Test that state persists across operations
            setModelScore('test-model', '75');
            disableModel('disabled-model');
            
            expect(getModelScore('test-model')).toBe(75);
            expect(taskState.disabledModels.has('disabled-model')).toBe(true);
        });
    });
});