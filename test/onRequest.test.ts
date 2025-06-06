/**
 * Tests for onRequest hook functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runMECH } from '../simple';
import { mockSuccessResponse, createMockEnhancedRequest } from './test-utils';
import { mechState } from '../mech_state';
import type { Agent, ResponseInput } from '../types';

// Mock ensemble's ensembleRequest and getModelFromClass
vi.mock('@just-every/ensemble', async () => {
    const actual = await vi.importActual('@just-every/ensemble');
    return {
        ...actual,
        ensembleRequest: vi.fn(),
        getModelFromClass: vi.fn((modelClass) => {
            // Return appropriate model based on class
            const models: Record<string, string> = {
                'reasoning': 'gpt-4-turbo',
                'standard': 'gpt-3.5-turbo',
                'code': 'gpt-4-turbo',
                'metacognition': 'gpt-4-turbo'
            };
            // Always resolve successfully with a model
            const model = models[modelClass] || 'gpt-3.5-turbo';
            return Promise.resolve(model);
        }),
        MODEL_CLASSES: {
            reasoning: ['gpt-4-turbo', 'claude-3-opus', 'o1-mini'],
            standard: ['gpt-3.5-turbo', 'claude-3-haiku', 'gemini-1.5-flash'],
            code: ['gpt-4-turbo', 'claude-3-opus', 'grok-beta'],
            metacognition: ['gpt-4-turbo', 'claude-3-opus']
        },
        // Keep these from actual implementation
        ToolCallAction: actual.ToolCallAction
    };
});

describe('onRequest Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mech state
        mechState.modelScores = {};
        mechState.disabledModels.clear();
        mechState.lastModelUsed = undefined;
        mechState.llmRequestCount = 0;
    });

    it('should call onRequest hook before making request', async () => {
        const { ensembleRequest } = await import('@just-every/ensemble');
        // Use the mock that properly calls task_complete
        vi.mocked(ensembleRequest).mockImplementation(mockSuccessResponse('I will complete this task', 'Task completed successfully'));
        
        const onRequestMock = vi.fn(async (agent: Agent, messages: ResponseInput) => {
            // Verify original agent is passed
            expect(agent.name).toBe('TestAgent');
            
            // Modify agent
            const modifiedAgent = { ...agent, name: 'ModifiedAgent' };
            
            // Add a system message
            const modifiedMessages = [
                { role: 'system' as const, content: 'Modified by onRequest' },
                ...messages
            ];
            
            return [modifiedAgent, modifiedMessages] as [Agent, ResponseInput];
        });

        const result = await runMECH({
            agent: {
                name: 'TestAgent',
                modelClass: 'standard',
                onRequest: onRequestMock
            },
            task: 'Test task'
        });

        // Verify onRequest was called
        expect(onRequestMock).toHaveBeenCalledOnce();
        
        // Verify the request was made with modified messages
        expect(ensembleRequest).toHaveBeenCalled();
        const requestCall = vi.mocked(ensembleRequest).mock.calls[0];
        const messages = requestCall[0]; // messages are now the first parameter
        
        // Should have system message added by onRequest
        expect(messages[0]).toEqual({
            role: 'system',
            content: 'Modified by onRequest'
        });
        
        expect(result.status).toBe('complete');
    });

    it('should work without onRequest hook', async () => {
        const { ensembleRequest } = await import('@just-every/ensemble');
        vi.mocked(ensembleRequest).mockImplementation(mockSuccessResponse('Completing the task', 'Task completed'));

        const result = await runMECH({
            agent: {
                name: 'TestAgent',
                modelClass: 'standard'
            },
            task: 'Test task'
        });

        expect(ensembleRequest).toHaveBeenCalled();
        expect(result.status).toBe('complete');
    });

    it('should handle errors in onRequest hook', async () => {
        const { ensembleRequest } = await import('@just-every/ensemble');
        vi.mocked(ensembleRequest).mockImplementation(mockSuccessResponse());
        
        const onRequestMock = vi.fn(async () => {
            throw new Error('onRequest failed');
        });

        await expect(runMECH({
            agent: {
                name: 'TestAgent',
                onRequest: onRequestMock
            },
            task: 'Test task'
        })).rejects.toThrow('onRequest failed');
    });

    it('should pass modified agent properties through pipeline', async () => {
        const { ensembleRequest } = await import('@just-every/ensemble');
        vi.mocked(ensembleRequest).mockImplementation(mockSuccessResponse());
        
        const onRequestMock = vi.fn(async (agent: Agent, messages: ResponseInput) => {
            // Modify agent to use a different model
            const modifiedAgent = { 
                ...agent, 
                model: 'gpt-4-turbo',
                modelClass: 'reasoning' 
            };
            
            return [modifiedAgent, messages] as [Agent, ResponseInput];
        });

        await runMECH({
            agent: {
                name: 'TestAgent',
                model: 'gpt-3.5-turbo',
                onRequest: onRequestMock
            },
            task: 'Test task'
        });

        // Verify the modified agent properties were used
        expect(ensembleRequest).toHaveBeenCalled();
        const requestCall = vi.mocked(ensembleRequest).mock.calls[0];
        const agentUsed = requestCall[1]; // agent is now the second parameter
        
        // Should use the model from onRequest modification
        expect(agentUsed.model).toBe('gpt-4-turbo');
    });

    it('should allow onRequest to add tools dynamically', async () => {
        const { ensembleRequest } = await import('@just-every/ensemble');
        vi.mocked(ensembleRequest).mockImplementation(mockSuccessResponse());
        
        const customTool = {
            function: vi.fn(() => 'Custom tool result'),
            definition: {
                type: 'function' as const,
                function: {
                    name: 'custom_tool',
                    description: 'A custom tool',
                    parameters: {}
                }
            }
        };
        
        const onRequestMock = vi.fn(async (agent: Agent, messages: ResponseInput) => {
            // Add a tool dynamically
            const modifiedAgent = { 
                ...agent,
                tools: [...(agent.tools || []), customTool]
            };
            
            return [modifiedAgent, messages] as [Agent, ResponseInput];
        });

        await runMECH({
            agent: {
                name: 'TestAgent',
                modelClass: 'standard',
                onRequest: onRequestMock
            },
            task: 'Test task'
        });

        // Verify request was made with tools
        expect(ensembleRequest).toHaveBeenCalled();
        const requestCall = vi.mocked(ensembleRequest).mock.calls[0];
        const agent = requestCall[1]; // agent is now the second parameter
        
        // Should include the dynamically added tool
        expect(agent.tools).toContainEqual(expect.objectContaining({
            definition: expect.objectContaining({
                function: expect.objectContaining({
                    name: 'custom_tool'
                })
            })
        }));
    });
});