/**
 * Enhanced Request Integration Tests
 * 
 * Tests specifically for the integration with ensemble's request
 * and the new tool handling capabilities.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
    runMECH,
    mechState,
    resetLLMRequestCount,
    resetCostTracker,
    type RunMechOptions,
    type MechAgent
} from '../index.js';
import { request, ToolCallAction, RequestContext, EnhancedRequestMock } from '@just-every/ensemble';
import { getMECHTools } from '../mech_tools.js';
import { createFullContext } from '../utils/internal_utils.js';

// Mock ensemble
vi.mock('@just-every/ensemble', async () => {
    const actual = await vi.importActual('@just-every/ensemble');
    return {
        ...actual,
        request: vi.fn(),
        tool: actual.tool,
        createRequestContextWithState: actual.createRequestContextWithState,
        ToolCallAction: actual.ToolCallAction,
        CostTracker: vi.fn(() => ({
            getTotalCost: () => 0.0015,
            reset: () => {},
            trackUsage: () => {}
        })),
        getModelFromClass: vi.fn(() => 'test-model'),
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
    };
});

describe('Enhanced Request Integration', () => {
    let mockAgent: MechAgent;
    let mockedRequest: ReturnType<typeof vi.fn>;
    
    beforeEach(() => {
        resetLLMRequestCount();
        resetCostTracker();
        mechState.disabledModels.clear();
        mechState.modelScores = {};
        
        mockAgent = {
            name: 'EnhancedTestAgent',
            agent_id: 'enhanced-test-' + Date.now(),
            modelClass: 'reasoning'
        };
        
        mockedRequest = request as ReturnType<typeof vi.fn>;
        mockedRequest.mockClear();
    });

    describe('Tool Handler Integration', () => {
        it('should pass tool handler with proper hooks', async () => {
            let capturedOptions: any;
            
            mockedRequest.mockImplementation((model, messages, options) => {
                capturedOptions = options;
                const context = options?.toolHandler?.context || {};
                return (async function* () {
                    yield { type: 'message_delta', content: 'Test response' };
                    
                    // Simulate tool call
                    const toolCall = {
                        id: 'test-1',
                        type: 'function' as const,
                        function: {
                            name: 'task_complete',
                            arguments: JSON.stringify({ result: 'Test completed' })
                        }
                    };
                    
                    if (options?.toolHandler?.onToolCall) {
                        const action = await options.toolHandler.onToolCall(toolCall, context);
                        if (action === ToolCallAction.EXECUTE && options?.toolHandler?.onToolComplete) {
                            await options.toolHandler.onToolComplete(toolCall, 'Test completed', context);
                        }
                    }
                })();
            });

            await runMECH({
                agent: mockAgent,
                task: 'Test tool handler'
            });

            expect(capturedOptions).toBeDefined();
            expect(capturedOptions.toolHandler).toBeDefined();
            expect(capturedOptions.toolHandler.onToolCall).toBeDefined();
            expect(capturedOptions.toolHandler.onToolComplete).toBeDefined();
            expect(capturedOptions.toolHandler.executionMode).toBe('sequential');
            expect(capturedOptions.toolHandler.errorStrategy).toBe('return-error');
        });

        it('should handle tool execution flow correctly', async () => {
            const toolCallSequence: string[] = [];
            
            mockedRequest.mockImplementation((model, messages, options) => {
                const context = options?.toolHandler?.context || {};
                return (async function* () {
                    yield { type: 'message_delta', content: 'Processing' };
                    
                    // Test multiple tool calls
                    const toolCalls = [
                        {
                            id: 'test-1',
                            type: 'function' as const,
                            function: {
                                name: 'test_tool',
                                arguments: JSON.stringify({ action: 'step1' })
                            }
                        },
                        {
                            id: 'test-2',
                            type: 'function' as const,
                            function: {
                                name: 'task_complete',
                                arguments: JSON.stringify({ result: 'All steps completed' })
                            }
                        }
                    ];
                    
                    for (const toolCall of toolCalls) {
                        if (options?.toolHandler?.onToolCall) {
                            toolCallSequence.push(`onToolCall:${toolCall.function.name}`);
                            const action = await options.toolHandler.onToolCall(toolCall, context);
                            
                            if (action === ToolCallAction.EXECUTE && options?.toolHandler?.onToolComplete) {
                                toolCallSequence.push(`onToolComplete:${toolCall.function.name}`);
                                await options.toolHandler.onToolComplete(
                                    toolCall, 
                                    `Result from ${toolCall.function.name}`,
                                    context
                                );
                            }
                        }
                    }
                })();
            });

            const result = await runMECH({
                agent: mockAgent,
                task: 'Test tool sequence'
            });

            expect(result.status).toBe('complete');
            expect(toolCallSequence).toEqual([
                'onToolCall:test_tool',
                'onToolComplete:test_tool',
                'onToolCall:task_complete',
                'onToolComplete:task_complete'
            ]);
        });
    });

    describe('Loop Configuration', () => {
        it('should configure loop with proper settings', async () => {
            let capturedOptions: any;
            
            mockedRequest.mockImplementation((model, messages, options) => {
                capturedOptions = options;
                const context = options?.toolHandler?.context || {};
                return (async function* () {
                    yield { type: 'message_delta', content: 'Test' };
                    
                    // Complete immediately
                    const toolCall = {
                        id: 'test-1',
                        type: 'function' as const,
                        function: {
                            name: 'task_complete',
                            arguments: JSON.stringify({ result: 'Done' })
                        }
                    };
                    
                    if (options?.toolHandler?.onToolCall) {
                        await options.toolHandler.onToolCall(toolCall, context);
                        if (options?.toolHandler?.onToolComplete) {
                            await options.toolHandler.onToolComplete(toolCall, 'Done', context);
                        }
                    }
                })();
            });

            await runMECH({
                agent: mockAgent,
                task: 'Test loop config',
                loop: true
            });

            expect(capturedOptions.loop).toBeDefined();
            expect(capturedOptions.loop.maxIterations).toBe(100);
            expect(capturedOptions.loop.continueCondition).toBeDefined();
            expect(capturedOptions.loop.onIteration).toBeDefined();
        });

        it('should handle loop iteration callbacks', async () => {
            let iterationCount = 0;
            
            mockedRequest.mockImplementation((model, messages, options) => {
                const context = options?.toolHandler?.context || {};
                return (async function* () {
                    // Simulate multiple iterations
                    if (options?.loop?.onIteration) {
                        await options.loop.onIteration(++iterationCount, context);
                    }
                    
                    yield { type: 'message_delta', content: 'Iteration ' + iterationCount };
                    
                    // Complete after 2 iterations
                    if (iterationCount >= 2) {
                        const toolCall = {
                            id: 'test-1',
                            type: 'function' as const,
                            function: {
                                name: 'task_complete',
                                arguments: JSON.stringify({ result: 'Completed after iterations' })
                            }
                        };
                        
                        if (options?.toolHandler?.onToolCall) {
                            const action = await options.toolHandler.onToolCall(toolCall, context);
                            if (action === ToolCallAction.EXECUTE && options?.toolHandler?.onToolComplete) {
                                const args = JSON.parse(toolCall.function.arguments);
                                const result = `Task completed: ${args.result}`;
                                await options.toolHandler.onToolComplete(toolCall, result, context);
                            }
                        }
                    }
                })();
            });

            // Force the test to complete after first iteration
            mockedRequest.mockImplementation((model, messages, options) => {
                const context = options?.toolHandler?.context || {};
                return (async function* () {
                    yield { type: 'message_delta', content: 'Completing immediately' };
                    
                    const toolCall = {
                        id: 'test-1',
                        type: 'function' as const,
                        function: {
                            name: 'task_complete',
                            arguments: JSON.stringify({ result: 'Done' })
                        }
                    };
                    
                    if (options?.toolHandler?.onToolCall) {
                        const action = await options.toolHandler.onToolCall(toolCall, context);
                        if (action === ToolCallAction.EXECUTE && options?.toolHandler?.onToolComplete) {
                            const args = JSON.parse(toolCall.function.arguments);
                            const result = `Task completed: ${args.result}`;
                            await options.toolHandler.onToolComplete(toolCall, result, context);
                        }
                    }
                })();
            });
            
            await runMECH({
                agent: mockAgent,
                task: 'Test iterations'
            });

            expect(mechState.llmRequestCount).toBeGreaterThan(0);
        });
    });

    describe('Tool Categories', () => {
        it('should assign proper categories to MECH tools', async () => {
            const context = createFullContext({
                agent: mockAgent,
                runAgent: async () => ({ response: 'test' })
            });
            
            const mechTools = getMECHTools(context);
            
            expect(mechTools).toHaveLength(2);
            expect(mechTools[0].category).toBe('control');
            expect(mechTools[0].priority).toBe(100);
            expect(mechTools[0].sideEffects).toBe(true);
            expect(mechTools[1].category).toBe('control');
            expect(mechTools[1].priority).toBe(100);
            expect(mechTools[1].sideEffects).toBe(true);
        });
    });

    describe('Tool Result Transformation', () => {
        it('should transform tool results with metrics', async () => {
            let capturedOptions: any;
            
            mockedRequest.mockImplementation((model, messages, options) => {
                capturedOptions = options;
                const context = options?.toolHandler?.context || {};
                return (async function* () {
                    yield { type: 'message_delta', content: 'Working' };
                    
                    const toolCall = {
                        id: 'test-1',
                        type: 'function' as const,
                        function: {
                            name: 'task_complete',
                            arguments: JSON.stringify({ result: 'Task done' })
                        }
                    };
                    
                    if (options?.toolHandler?.onToolCall) {
                        await options.toolHandler.onToolCall(toolCall, context);
                        if (options?.toolHandler?.onToolComplete) {
                            await options.toolHandler.onToolComplete(toolCall, 'Task done', context);
                        }
                    }
                })();
            });

            await runMECH({
                agent: mockAgent,
                task: 'Test transformation'
            });

            expect(capturedOptions.toolResultTransformer).toBeDefined();
            expect(capturedOptions.toolResultTransformer.augment).toBeDefined();
            
            // Test the augment function
            const result = capturedOptions.toolResultTransformer.augment(
                'task_complete',
                'Original result',
                { duration: 1000, tokenCount: 100 }
            );
            
            expect(result).toContain('Original result');
            expect(result).toContain('METRICS');
            expect(result).toContain('Duration');
            expect(result).toContain('Total cost');
        });
    });

    describe('Error Handling', () => {
        it('should handle tool execution errors gracefully', async () => {
            mockedRequest.mockImplementation((model, messages, options) => {
                const context = options?.toolHandler?.context || {};
                return (async function* () {
                    yield { type: 'message_delta', content: 'Attempting task' };
                    
                    // Simulate error in tool
                    const toolCall = {
                        id: 'test-1',
                        type: 'function' as const,
                        function: {
                            name: 'task_fatal_error',
                            arguments: JSON.stringify({ error: 'Something went wrong' })
                        }
                    };
                    
                    if (options?.toolHandler?.onToolCall) {
                        const action = await options.toolHandler.onToolCall(toolCall, context);
                        if (action === ToolCallAction.EXECUTE && options?.toolHandler?.onToolComplete) {
                            await options.toolHandler.onToolComplete(toolCall, 'Something went wrong', context);
                        }
                    }
                })();
            });

            const result = await runMECH({
                agent: mockAgent,
                task: 'Test error handling'
            });

            expect(result.status).toBe('fatal_error');
            expect(result.mechOutcome?.error).toBe('Something went wrong');
        });

        it('should handle request throwing errors', async () => {
            mockedRequest.mockImplementation(() => {
                throw new Error('Network error');
            });

            const result = await runMECH({
                agent: mockAgent,
                task: 'Test network error'
            });

            expect(result.status).toBe('fatal_error');
            expect(result.mechOutcome?.error).toContain('Network error');
        });
    });

    describe('Request Context Integration', () => {
        it('should properly manage request context state', async () => {
            let capturedContext: RequestContext | undefined;
            
            mockedRequest.mockImplementation((model, messages, options) => {
                capturedContext = options?.toolHandler?.context;
                const context = options?.toolHandler?.context || {};
                return (async function* () {
                    yield { type: 'message_delta', content: 'Testing context' };
                    
                    // Test context methods
                    if (context.setMetadata) {
                        context.setMetadata('test_key', 'test_value');
                    }
                    
                    const toolCall = {
                        id: 'test-1',
                        type: 'function' as const,
                        function: {
                            name: 'task_complete',
                            arguments: JSON.stringify({ result: 'Context test complete' })
                        }
                    };
                    
                    if (options?.toolHandler?.onToolCall) {
                        await options.toolHandler.onToolCall(toolCall, context);
                        if (options?.toolHandler?.onToolComplete) {
                            await options.toolHandler.onToolComplete(toolCall, 'Done', context);
                        }
                    }
                })();
            });

            await runMECH({
                agent: mockAgent,
                task: 'Test context'
            });

            expect(capturedContext).toBeDefined();
            expect(capturedContext?.metadata).toBeDefined();
            expect(capturedContext?.shouldContinue).toBe(false); // Should be false after completion
            expect(capturedContext?.getMetadata('test_key')).toBe('test_value');
        });
    });
});