import { describe, it, expect, beforeEach } from 'vitest';
import {
    mechState,
    setMetaFrequency,
    getMetaFrequency,
    setModelScore,
    getModelScore,
    disableModel,
    enableModel,
    listDisabledModels,
    listModelScores,
    incrementLLMRequestCount,
    resetLLMRequestCount
} from '../mech_state.js';

describe('MECH State Management', () => {
    beforeEach(() => {
        // Reset state before each test
        resetLLMRequestCount();
        setMetaFrequency('5');
        mechState.disabledModels.clear();
        // Clear model scores
        Object.keys(mechState.modelScores).forEach(key => {
            delete mechState.modelScores[key];
        });
    });

    describe('Meta-cognition frequency', () => {
        it('should set and get meta frequency', () => {
            setMetaFrequency('10');
            expect(getMetaFrequency()).toBe('10');
            expect(mechState.metaFrequency).toBe('10');

            setMetaFrequency('20');
            expect(getMetaFrequency()).toBe('20');

            setMetaFrequency('40');
            expect(getMetaFrequency()).toBe('40');
        });

        it('should handle invalid frequency values', () => {
            const result = setMetaFrequency('invalid' as any);
            expect(result).toContain('Invalid frequency');
            expect(mechState.metaFrequency).toBe('5'); // Should remain at default
        });

        it('should only accept valid frequencies', () => {
            const validFreqs = ['5', '10', '20', '40'];
            validFreqs.forEach(freq => {
                setMetaFrequency(freq as any);
                expect(mechState.metaFrequency).toBe(freq);
            });
        });
    });

    describe('LLM request counting', () => {
        it('should increment request count', () => {
            expect(mechState.llmRequestCount).toBe(0);
            
            incrementLLMRequestCount();
            expect(mechState.llmRequestCount).toBe(1);
            
            incrementLLMRequestCount();
            incrementLLMRequestCount();
            expect(mechState.llmRequestCount).toBe(3);
        });

        it('should reset request count', () => {
            incrementLLMRequestCount();
            incrementLLMRequestCount();
            expect(mechState.llmRequestCount).toBe(2);
            
            resetLLMRequestCount();
            expect(mechState.llmRequestCount).toBe(0);
        });
    });

    describe('Model scoring', () => {
        it('should set and get model scores', () => {
            setModelScore('gpt-4', '85');
            expect(getModelScore('gpt-4')).toBe(85);
            
            setModelScore('claude-3', '90');
            expect(getModelScore('claude-3')).toBe(90);
        });

        it('should handle class-specific scores', () => {
            setModelScore('gpt-4', '80', 'code');
            setModelScore('gpt-4', '85', 'reasoning');
            
            expect(getModelScore('gpt-4', 'code')).toBe(80);
            expect(getModelScore('gpt-4', 'reasoning')).toBe(85);
            expect(getModelScore('gpt-4')).toBe(50); // Default when no overall score
        });

        it('should return default score for unknown models', () => {
            expect(getModelScore('unknown-model')).toBe(50);
            expect(getModelScore('unknown-model', 'code')).toBe(50);
        });

        it('should validate score range', () => {
            const result1 = setModelScore('gpt-4', '150');
            expect(result1).toContain('Invalid score');
            
            const result2 = setModelScore('gpt-4', '-10');
            expect(result2).toContain('Invalid score');
            
            const result3 = setModelScore('gpt-4', 'abc');
            expect(result3).toContain('Invalid score');
        });

        it('should list all model scores', () => {
            setModelScore('gpt-4', '80');
            setModelScore('claude-3', '85');
            setModelScore('gpt-4', '75', 'code');
            
            const scores = listModelScores();
            expect(scores).toContain('gpt-4');
            expect(scores).toContain('claude-3');
            expect(scores).toContain('80');
            expect(scores).toContain('85');
            expect(scores).toContain('code: 75');
        });
    });

    describe('Model enable/disable', () => {
        it('should disable and enable models', () => {
            expect(mechState.disabledModels.has('gpt-4')).toBe(false);
            
            disableModel('gpt-4');
            expect(mechState.disabledModels.has('gpt-4')).toBe(true);
            
            enableModel('gpt-4');
            expect(mechState.disabledModels.has('gpt-4')).toBe(false);
        });

        it('should handle multiple models', () => {
            disableModel('gpt-4');
            disableModel('claude-3');
            disableModel('gemini');
            
            expect(mechState.disabledModels.size).toBe(3);
            expect(mechState.disabledModels.has('gpt-4')).toBe(true);
            expect(mechState.disabledModels.has('claude-3')).toBe(true);
            expect(mechState.disabledModels.has('gemini')).toBe(true);
            
            enableModel('claude-3');
            expect(mechState.disabledModels.size).toBe(2);
            expect(mechState.disabledModels.has('claude-3')).toBe(false);
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
            expect(mechState.disabledModels.size).toBe(1);
            
            enableModel('gpt-4');
            enableModel('gpt-4'); // Already enabled
            expect(mechState.disabledModels.size).toBe(0);
        });
    });

    describe('State persistence', () => {
        it('should track last model used', () => {
            expect(mechState.lastModelUsed).toBeUndefined();
            
            mechState.lastModelUsed = 'gpt-4';
            expect(mechState.lastModelUsed).toBe('gpt-4');
            
            mechState.lastModelUsed = 'claude-3';
            expect(mechState.lastModelUsed).toBe('claude-3');
        });
    });
});