import { describe, it, expect, beforeEach } from 'vitest';
import {
    mindState,
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
        mindState.disabledModels.clear();
        // Clear model scores
        Object.keys(mindState.modelScores).forEach(key => {
            delete mindState.modelScores[key];
        });
    });

    describe('Meta-cognition frequency', () => {
        it('should set and get meta frequency', () => {
            setMetaFrequency('10');
            expect(mindState.metaFrequency).toBe('10');

            setMetaFrequency('20');
            expect(mindState.metaFrequency).toBe('20');

            setMetaFrequency('40');
            expect(mindState.metaFrequency).toBe('40');
        });

        it('should handle invalid frequency values', () => {
            expect(() => setMetaFrequency('invalid' as any)).toThrow(/Meta frequency must be one of/);
            expect(mindState.metaFrequency).toBe('5'); // Should remain at default
        });

        it('should only accept valid frequencies', () => {
            const validFreqs = ['5', '10', '20', '40'];
            validFreqs.forEach(freq => {
                setMetaFrequency(freq as any);
                expect(mindState.metaFrequency).toBe(freq);
            });
        });
    });

    describe('LLM request counting', () => {
        it('should increment request count', () => {
            expect(mindState.llmRequestCount).toBe(0);
            
            incrementLLMRequestCount();
            expect(mindState.llmRequestCount).toBe(1);
            
            incrementLLMRequestCount();
            incrementLLMRequestCount();
            expect(mindState.llmRequestCount).toBe(3);
        });

        it('should reset request count', () => {
            incrementLLMRequestCount();
            incrementLLMRequestCount();
            expect(mindState.llmRequestCount).toBe(2);
            
            resetLLMRequestCount();
            expect(mindState.llmRequestCount).toBe(0);
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
            expect(mindState.disabledModels.has('gpt-4')).toBe(false);
            
            disableModel('gpt-4');
            expect(mindState.disabledModels.has('gpt-4')).toBe(true);
            
            disableModel('gpt-4', false); // Enable by passing false
            expect(mindState.disabledModels.has('gpt-4')).toBe(false);
        });

        it('should handle multiple models', () => {
            disableModel('gpt-4');
            disableModel('claude-3');
            disableModel('gemini');
            
            expect(mindState.disabledModels.size).toBe(3);
            expect(mindState.disabledModels.has('gpt-4')).toBe(true);
            expect(mindState.disabledModels.has('claude-3')).toBe(true);
            expect(mindState.disabledModels.has('gemini')).toBe(true);
            
            disableModel('claude-3', false); // Enable by passing false
            expect(mindState.disabledModels.size).toBe(2);
            expect(mindState.disabledModels.has('claude-3')).toBe(false);
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
            expect(mindState.disabledModels.size).toBe(1);
            
            disableModel('gpt-4', false); // Enable by passing false
            disableModel('gpt-4', false); // Already enabled
            expect(mindState.disabledModels.size).toBe(0);
        });
    });

    describe('State persistence', () => {
        it('should maintain state between operations', () => {
            // Test that state persists across operations
            setModelScore('test-model', '75');
            disableModel('disabled-model');
            
            expect(getModelScore('test-model')).toBe(75);
            expect(mindState.disabledModels.has('disabled-model')).toBe(true);
        });
    });
});