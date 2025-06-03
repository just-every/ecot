import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rotateModel } from '../model_rotation.js';
import { mechState, disableModel, setModelScore, enableModel } from '../mech_state.js';
import type { MechAgent } from '../types.js';

// Mock ensemble imports
vi.mock('@just-every/ensemble', () => ({
    MODEL_CLASSES: {
        standard: {
            models: ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus']
        },
        reasoning: {
            models: ['gpt-4-turbo', 'claude-3-opus', 'gemini-pro']
        },
        code: {
            models: ['gpt-4', 'claude-3-opus', 'codellama']
        }
    },
    getModelFromClass: vi.fn().mockRejectedValue(new Error('Mock: No override')),
    findModel: vi.fn().mockReturnValue({ id: 'gpt-4', name: 'GPT-4' }),
    ModelClassID: {},
    createToolFunction: vi.fn((fn, description, params, returns, functionName) => ({
        function: fn,
        definition: {
            type: 'function',
            function: {
                name: functionName || fn.name || 'anonymous',
                description: description || '',
                parameters: {
                    type: 'object',
                    properties: params || {},
                    required: []
                }
            }
        }
    }))
}));

describe('Model Rotation', () => {
    let mockAgent: MechAgent;

    beforeEach(() => {
        // Reset state
        mechState.lastModelUsed = undefined;
        mechState.disabledModels.clear();
        Object.keys(mechState.modelScores).forEach(key => {
            delete mechState.modelScores[key];
        });

        // Create mock agent
        mockAgent = {
            name: 'TestAgent',
            agent_id: 'test-agent-001',
            modelClass: 'reasoning',
            export: () => ({ name: 'TestAgent' }),
            getTools: async () => []
        };
    });

    describe('Basic rotation', () => {
        it('should select a model from the agent model class', async () => {
            const model = await rotateModel(mockAgent);
            expect(model).toBeDefined();
            expect(['gpt-4-turbo', 'claude-3-opus', 'gemini-pro']).toContain(model);
        });

        it('should avoid selecting the last used model', async () => {
            // Set lastModelUsed but not agent.model (so rotation happens)
            mechState.lastModelUsed = 'gpt-4-turbo';
            
            const model = await rotateModel(mockAgent);
            expect(model).toBeDefined();
            expect(model).not.toBe('gpt-4-turbo');
        });

        it('should skip disabled models', async () => {
            disableModel('gpt-4-turbo');
            disableModel('claude-3-opus');
            
            const model = await rotateModel(mockAgent);
            expect(model).toBe('gemini-pro');
        });

        it('should handle all models being disabled', async () => {
            disableModel('gpt-4-turbo');
            disableModel('claude-3-opus');
            disableModel('gemini-pro');
            
            const model = await rotateModel(mockAgent);
            expect(model).toBeUndefined();
        });
    });

    describe('Score-based selection', () => {
        it('should prefer models with higher scores', async () => {
            setModelScore('gpt-4-turbo', '10');
            setModelScore('claude-3-opus', '90');
            setModelScore('gemini-pro', '10');
            
            // Run multiple times to test probability
            const selections = new Map<string, number>();
            for (let i = 0; i < 100; i++) {
                // Reset last model to allow all selections
                mechState.lastModelUsed = undefined;
                const model = await rotateModel(mockAgent);
                if (model) {
                    selections.set(model, (selections.get(model) || 0) + 1);
                }
            }
            
            // Claude should be selected most often
            const claudeCount = selections.get('claude-3-opus') || 0;
            const gptCount = selections.get('gpt-4-turbo') || 0;
            const geminiCount = selections.get('gemini-pro') || 0;
            
            expect(claudeCount).toBeGreaterThan(gptCount);
            expect(claudeCount).toBeGreaterThan(geminiCount);
        });

        it('should handle all models having zero scores', async () => {
            setModelScore('gpt-4-turbo', '0');
            setModelScore('claude-3-opus', '0');
            setModelScore('gemini-pro', '0');
            
            const model = await rotateModel(mockAgent);
            expect(model).toBeDefined();
            expect(['gpt-4-turbo', 'claude-3-opus', 'gemini-pro']).toContain(model);
        });

        it('should use class-specific scores when available', async () => {
            setModelScore('gpt-4-turbo', '50', 'reasoning');
            setModelScore('gpt-4-turbo', '10', 'code');
            
            const model = await rotateModel(mockAgent, 'reasoning');
            // Should use reasoning score of 50, not code score of 10
            expect(model).toBeDefined();
        });
    });

    describe('Model class handling', () => {
        it('should use provided model class over agent model class', async () => {
            mockAgent.modelClass = 'reasoning';
            const model = await rotateModel(mockAgent, 'code');
            
            expect(model).toBeDefined();
            expect(['gpt-4', 'claude-3-opus', 'codellama']).toContain(model);
        });

        it('should fall back to standard models for invalid class', async () => {
            mockAgent.modelClass = 'invalid-class' as any;
            const model = await rotateModel(mockAgent);
            
            expect(model).toBeDefined();
            expect(['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus']).toContain(model);
        });

        it('should handle missing model class', async () => {
            mockAgent.modelClass = undefined;
            const model = await rotateModel(mockAgent);
            
            expect(model).toBeUndefined();
        });
    });

    describe('Error handling', () => {
        it('should validate agent parameter', async () => {
            await expect(rotateModel(null as any)).rejects.toThrow('Invalid agent');
            await expect(rotateModel(undefined as any)).rejects.toThrow('Invalid agent');
            await expect(rotateModel('not-an-agent' as any)).rejects.toThrow('Invalid agent');
        });

        it('should handle edge cases gracefully', async () => {
            // All models disabled except last used
            mechState.lastModelUsed = 'gpt-4-turbo';
            disableModel('claude-3-opus');
            disableModel('gemini-pro');
            
            const model = await rotateModel(mockAgent);
            expect(model).toBeUndefined();
        });
    });

    describe('State tracking', () => {
        it('should update lastModelUsed', async () => {
            mockAgent.model = 'claude-3-opus';
            await rotateModel(mockAgent);
            
            expect(mechState.lastModelUsed).toBe('claude-3-opus');
        });

        it('should log selection details', async () => {
            const consoleSpy = vi.spyOn(console, 'log');
            
            await rotateModel(mockAgent);
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[MECH]')
            );
            
            consoleSpy.mockRestore();
        });
    });
});