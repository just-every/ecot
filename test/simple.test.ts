import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runMECH, getTotalCost, resetCostTracker } from '../index.js';
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
            // Return a valid model for the given class
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

// Helper function to create proper mock implementation
function createMockImplementation(response: string, toolCall?: { name: string; args: any }) {
    return async function* (messages: any, agent: any) {
        yield { type: 'message_delta', content: response } as any;
        
        if (toolCall) {
            const tc = {
                id: 'call_' + Date.now(),
                type: 'function' as const,
                function: {
                    name: toolCall.name,
                    arguments: JSON.stringify(toolCall.args)
                }
            };
            
            // Find and execute the tool
            const tool = agent.tools?.find((t: any) => 
                t.definition.function.name === toolCall.name
            );
            if (tool && agent.onToolResult) {
                const result = await tool.function(toolCall.args);
                
                // Call onToolResult with the result
                await agent.onToolResult({
                    toolCall: tc,
                    id: tc.id,
                    call_id: tc.id,
                    output: result,
                    error: undefined
                });
            }
            
            yield {
                type: 'tool_call',
                tool_calls: [tc]
            } as any;
        }
    };
}

describe('Simple MECH API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetCostTracker();
    });

    it('should complete a simple task with minimal configuration', async () => {
        const mockEnsembleRequest = vi.mocked(ensemble.ensembleRequest);
        
        // Mock successful completion
        mockEnsembleRequest.mockImplementation(createMockImplementation(
            'Working on task...',
            { name: 'task_complete', args: { result: 'Task completed successfully' } }
        ));

        const result = await runMECH({
            agent: { 
                name: 'SimpleAgent',
                model: 'gpt-4'  // Specify model directly to bypass rotation
            },
            task: 'Say hello',
            loop: false
        });

        expect(result.status).toBe('complete');
        expect(result.mechOutcome?.result).toContain('Task completed');
        expect(mockEnsembleRequest).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
        const mockEnsembleRequest = vi.mocked(ensemble.ensembleRequest);
        
        // Mock error
        mockEnsembleRequest.mockImplementation(createMockImplementation(
            'Encountering error...',
            { name: 'task_fatal_error', args: { error: 'Unable to complete task' } }
        ));

        const result = await runMECH({
            agent: { 
                name: 'SimpleAgent',
                model: 'gpt-4'
            },
            task: 'Impossible task',
            loop: false
        });

        expect(result.status).toBe('fatal_error');
        expect(result.mechOutcome?.error).toContain('Unable to complete');
    });

    it('should work with custom agent model', async () => {
        const mockEnsembleRequest = vi.mocked(ensemble.ensembleRequest);
        
        mockEnsembleRequest.mockImplementation(createMockImplementation(
            'Using custom model...',
            { name: 'task_complete', args: { result: 'Custom model worked' } }
        ));

        const result = await runMECH({
            agent: { 
                name: 'CustomAgent',
                model: 'gpt-4'
            },
            task: 'Use specific model',
            loop: false
        });

        expect(result.status).toBe('complete');
        // Check that the agent configuration was passed
        const calls = mockEnsembleRequest.mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const [messages, agent] = calls[0];
        expect(agent.model).toBe('gpt-4');
    });

    it('should track costs', async () => {
        const mockEnsembleRequest = vi.mocked(ensemble.ensembleRequest);
        
        mockEnsembleRequest.mockImplementation(async function* (messages: any, agent: any) {
            yield { 
                type: 'cost_update',
                usage: {
                    input_tokens: 100,
                    output_tokens: 50
                }
            } as any;
            yield { type: 'message_delta', content: 'Processing...' } as any;
            
            // Simulate tool execution
            const toolCall = {
                id: 'call_cost',
                type: 'function' as const,
                function: {
                    name: 'task_complete',
                    arguments: JSON.stringify({ result: 'Done' })
                }
            };
            
            // Find and execute the tool
            const tool = agent.tools?.find((t: any) => 
                t.definition.function.name === 'task_complete'
            );
            if (tool && agent.onToolResult) {
                const result = await tool.function({ result: 'Done' });
                await agent.onToolResult({
                    toolCall,
                    id: toolCall.id,
                    call_id: toolCall.id,
                    output: result,
                    error: undefined
                });
            }
            
            yield { type: 'tool_call', tool_calls: [toolCall] } as any;
        });

        const result = await runMECH({
            agent: { 
                name: 'CostAgent',
                model: 'gpt-4'
            },
            task: 'Track costs',
            loop: false
        });

        expect(result.status).toBe('complete');
        expect(result.totalCost).toBeGreaterThanOrEqual(0);
    });

    it('should handle multi-turn conversations with loop', async () => {
        const mockEnsembleRequest = vi.mocked(ensemble.ensembleRequest);
        let callCount = 0;
        
        mockEnsembleRequest.mockImplementation(async function* (messages: any, agent: any) {
            callCount++;
            if (callCount === 1) {
                yield { type: 'message_delta', content: 'First turn...' } as any;
            } else if (callCount === 2) {
                yield { type: 'message_delta', content: 'Second turn...' } as any;
            } else {
                yield { type: 'message_delta', content: 'Final turn...' } as any;
                
                const toolCall = {
                    id: 'call_final',
                    type: 'function' as const,
                    function: {
                        name: 'task_complete',
                        arguments: JSON.stringify({ result: 'Multi-turn complete' })
                    }
                };
                
                // Find and execute the tool
                const tool = agent.tools?.find((t: any) => 
                    t.definition.function.name === 'task_complete'
                );
                if (tool && agent.onToolResult) {
                    const result = await tool.function({ result: 'Multi-turn complete' });
                    await agent.onToolResult({
                        toolCall,
                        id: toolCall.id,
                        call_id: toolCall.id,
                        output: result,
                        error: undefined
                    });
                }
                
                yield { type: 'tool_call', tool_calls: [toolCall] } as any;
            }
        });

        const result = await runMECH({
            agent: { 
                name: 'ConversationAgent',
                model: 'gpt-4'
            },
            task: 'Have a conversation',
            loop: true
        });

        expect(result.status).toBe('complete');
        expect(callCount).toBeGreaterThan(1);
    });

    it('should handle memory features when provided', async () => {
        const mockEnsembleRequest = vi.mocked(ensemble.ensembleRequest);
        const mockEnsembleEmbed = vi.mocked(ensemble.ensembleEmbed);
        
        const lookupMemories = vi.fn().mockResolvedValue([
            { text: 'Previous memory', metadata: {} }
        ]);
        const saveMemory = vi.fn();
        
        mockEnsembleRequest.mockImplementation(createMockImplementation(
            'Using memories...',
            { name: 'task_complete', args: { result: 'Memory task complete' } }
        ));

        const result = await runMECH({
            agent: { 
                name: 'MemoryAgent',
                model: 'gpt-4'
            },
            task: 'Remember things',
            loop: false,
            embed: async (text: string) => new Array(1536).fill(0.1),
            lookupMemories,
            saveMemory
        });

        expect(result.status).toBe('complete');
        // Note: ensembleEmbed won't be called because we're not providing all required memory functions
        // (specifically recordTaskStart is missing)
    });

    it('should support custom agent tools', async () => {
        const mockEnsembleRequest = vi.mocked(ensemble.ensembleRequest);
        const customTool = vi.fn().mockReturnValue('Custom tool result');
        
        mockEnsembleRequest.mockImplementation(createMockImplementation(
            'Using custom tool...',
            { name: 'task_complete', args: { result: 'Used custom tools' } }
        ));

        const result = await runMECH({
            agent: { 
                name: 'ToolAgent',
                model: 'gpt-4',
                tools: [{
                    function: customTool,
                    definition: {
                        type: 'function',
                        function: {
                            name: 'custom_tool',
                            description: 'A custom tool',
                            parameters: { type: 'object', properties: {}, required: [] }
                        }
                    }
                }]
            },
            task: 'Use custom tools',
            loop: false
        });

        expect(result.status).toBe('complete');
    });

    it('should respect history and status callbacks', async () => {
        const mockEnsembleRequest = vi.mocked(ensemble.ensembleRequest);
        const onHistory = vi.fn();
        const onStatus = vi.fn();
        
        mockEnsembleRequest.mockImplementation(createMockImplementation(
            'Processing...',
            { name: 'task_complete', args: { result: 'Done' } }
        ));

        const result = await runMECH({
            agent: { 
                name: 'CallbackAgent',
                model: 'gpt-4'
            },
            task: 'Test callbacks',
            loop: false,
            onHistory,
            onStatus
        });

        expect(result.status).toBe('complete');
        expect(onHistory).toHaveBeenCalled();
        expect(onStatus).toHaveBeenCalled();
    });
});