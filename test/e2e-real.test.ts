/**
 * Integration Tests for MECH
 * 
 * These tests verify MECH functionality without using real LLM APIs.
 * They use mocked responses to test the integration between components.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runMECH } from '../index.js';
import * as ensemble from '@just-every/ensemble';

// Mock the ensemble module
vi.mock('@just-every/ensemble', async () => {
    const actual = await vi.importActual<typeof ensemble>('@just-every/ensemble');
    return {
        ...actual,
        ensembleRequest: vi.fn(),
        ensembleEmbed: vi.fn(() => Promise.resolve(new Array(1536).fill(0.1))),
        MODEL_CLASSES: {
            standard: ['gpt-4', 'claude-3-5-sonnet-20241022', 'gemini-1.5-pro'],
            coding: ['grok-beta', 'claude-3-5-sonnet-20241022', 'gpt-4o'],
            reasoning: ['o1-preview', 'o1-mini', 'claude-3-5-sonnet-20241022'],
            creative: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'gemini-1.5-pro'],
            speed: ['gpt-4o-mini', 'claude-3-5-haiku-20241022', 'gemini-1.5-flash']
        },
        getModelFromClass: vi.fn((modelClass) => {
            const models = {
                standard: 'gpt-4',
                coding: 'grok-beta',
                reasoning: 'o1-preview',
                creative: 'claude-3-5-sonnet-20241022',
                speed: 'gpt-4o-mini'
            };
            return models[modelClass] || models.standard;
        }),
        createToolFunction: vi.fn((fn, description, params, mode, name) => ({
            function: fn,
            definition: {
                type: 'function',
                function: {
                    name: name || fn.name || 'anonymous',
                    description: description || '',
                    parameters: {
                        type: 'object',
                        properties: params || {},
                        required: Object.keys(params || {})
                    }
                }
            }
        })),
        ToolCallAction: {
            EXECUTE: 'execute',
            SKIP: 'skip',
            HALT: 'halt',
            DEFER: 'defer',
            RETRY: 'retry',
            REPLACE: 'replace'
        }
    };
});

describe('Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should complete a simple task', async () => {
        const mockEnsembleRequest = vi.mocked(ensemble.ensembleRequest);
        
        // Mock a successful completion with proper tool execution
        mockEnsembleRequest.mockImplementation(async function* (messages, agent) {
            yield { type: 'message_delta', content: 'Calculating...' } as any;
            
            const toolCall = {
                id: 'call_1',
                type: 'function' as const,
                function: {
                    name: 'task_complete',
                    arguments: JSON.stringify({ result: 'The answer is 4' })
                }
            };
            
            // Find and execute the tool
            const tool = agent.tools?.find((t: any) => 
                t.definition.function.name === 'task_complete'
            );
            if (tool && agent.onToolResult) {
                const result = await tool.function({ result: 'The answer is 4' });
                await agent.onToolResult({
                    toolCall,
                    id: toolCall.id,
                    call_id: toolCall.id,
                    output: result,
                    error: undefined
                });
            }
            
            yield { 
                type: 'tool_call',
                tool_calls: [toolCall]
            } as any;
        });

        const result = await runMECH({
            agent: { 
                name: 'TestAgent',
                model: 'gpt-4',
                modelClass: 'standard'
            },
            task: 'What is 2+2?',
            loop: false
        });

        expect(result.status).toBe('complete');
        expect(result.mechOutcome?.result).toBeDefined();
        expect(mockEnsembleRequest).toHaveBeenCalled();
    });

    it('should handle task failure appropriately', async () => {
        const mockEnsembleRequest = vi.mocked(ensemble.ensembleRequest);
        
        // Mock a failure with proper tool execution
        mockEnsembleRequest.mockImplementation(async function* (messages, agent) {
            yield { type: 'message_delta', content: 'Attempting task...' } as any;
            
            const toolCall = {
                id: 'call_2',
                type: 'function' as const,
                function: {
                    name: 'task_fatal_error',
                    arguments: JSON.stringify({ error: 'test error occurred' })
                }
            };
            
            // Find and execute the tool
            const tool = agent.tools?.find((t: any) => 
                t.definition.function.name === 'task_fatal_error'
            );
            if (tool && agent.onToolResult) {
                const result = await tool.function({ error: 'test error occurred' });
                await agent.onToolResult({
                    toolCall,
                    id: toolCall.id,
                    call_id: toolCall.id,
                    output: result,
                    error: undefined
                });
            }
            
            yield { 
                type: 'tool_call',
                tool_calls: [toolCall]
            } as any;
        });

        const result = await runMECH({
            agent: { 
                name: 'TestAgent',
                model: 'gpt-4',
                modelClass: 'standard'
            },
            task: 'Fail with test error',
            loop: false
        });

        expect(result.status).toBe('fatal_error');
        expect(result.mechOutcome?.error).toBeDefined();
        expect(mockEnsembleRequest).toHaveBeenCalled();
    });
});