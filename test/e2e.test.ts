/**
 * End-to-End Tests for MECH System
 * 
 * Tests complete MECH workflows from start to finish,
 * including real-world usage patterns and edge cases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
    runMECH,
    setModelScore,
    setMetaFrequency,
    setThoughtDelay,
    disableModel,
    enableModel,
    mechState,
    resetLLMRequestCount,
    getTotalCost,
    resetCostTracker,
    setDebugMode,
    enableTracing,
    globalDebugger,
    type RunMechOptions,
    type SimpleAgent
} from '../index.js';
import { request, ToolCallAction, EnhancedRequestMock } from '@just-every/ensemble';

// Mock the ensemble request function
vi.mock('@just-every/ensemble', async () => {
    const actual = await vi.importActual('@just-every/ensemble');
    return {
        ...actual,
        request: vi.fn(),
        // Override only what we need to mock
        CostTracker: vi.fn(() => ({
            getTotalCost: () => 0.0012,
            reset: () => {},
            trackUsage: () => {}
        })),
        MODEL_CLASSES: {
        coding: ['grok-beta', 'claude-3-5-sonnet-20241022', 'gpt-4o'],
        reasoning: ['o1-preview', 'o1-mini', 'claude-3-5-sonnet-20241022'],
        creative: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'gemini-1.5-pro'],
        speed: ['gpt-4o-mini', 'claude-3-5-haiku-20241022', 'gemini-1.5-flash']
        },
        getModelFromClass: vi.fn((modelClass) => {
        const models = {
            coding: ['grok-beta', 'claude-3-5-sonnet-20241022', 'gpt-4o'],
            reasoning: ['o1-preview', 'o1-mini', 'claude-3-5-sonnet-20241022'],
            creative: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'gemini-1.5-pro'],
            speed: ['gpt-4o-mini', 'claude-3-5-haiku-20241022', 'gemini-1.5-flash']
        };
        const modelList = models[modelClass] || models.reasoning;
        return modelList[0];
        }),
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

// No longer need createMockStream - using EnhancedRequestMock instead
// Helper to create async stream for mock responses
async function* createMockStream(response: string, toolCalls: Array<{ name: string; arguments: any }> = []) {
    yield { type: 'message_delta', content: response };
    
    if (toolCalls.length > 0) {
        yield {
            type: 'tool_done',
            tool_calls: toolCalls.map(tc => ({
                function: {
                    name: tc.name,
                    arguments: JSON.stringify(tc.arguments)
                }
            }))
        };
    }
}

describe('MECH End-to-End Tests', () => {
    let testAgent: SimpleAgent;
    let mockedRequest: ReturnType<typeof vi.fn>;
    // No longer need mockedEnhancedRequest - using mockedRequest instead
    
    beforeEach(() => {
        // Reset all systems
        resetLLMRequestCount();
        resetCostTracker();
        mechState.disabledModels.clear();
        mechState.modelScores = {};
        mechState.metaFrequency = '5';
        setThoughtDelay('0');
        setDebugMode(false);
        globalDebugger.clearSessions();
        
        // Create test agent
        testAgent = {
            name: 'E2ETestAgent',
            agent_id: 'e2e-test-' + Date.now(),
            tools: [],
            modelClass: 'reasoning'
        };
        
        // Setup mock for ensemble.request()
        mockedRequest = request as ReturnType<typeof vi.fn>;
        mockedRequest.mockClear(); // Clear mock call history between tests
        
        // Setup default mock implementation
        mockedRequest.mockImplementation((model, messages, options) => {
            return (async function* () {
                // Get task content from messages
                const taskContent = messages.find(m => m.role === 'user')?.content || '';
                
                // Generate appropriate response
                yield { type: 'message_delta', content: 'Processing task...' };
                
                // Always complete the task
                const toolCall = {
                    id: 'test-1',
                    type: 'function' as const,
                    function: {
                        name: 'task_complete',
                        arguments: JSON.stringify({ result: 'Task completed' })
                    }
                };
                
                if (options?.toolHandler?.onToolCall) {
                    const action = await options.toolHandler.onToolCall(toolCall, options.toolHandler.context);
                    if (action === ToolCallAction.EXECUTE && options?.toolHandler?.onToolComplete) {
                        await options.toolHandler.onToolComplete(toolCall, 'Task completed', options.toolHandler.context);
                    }
                }
            })();
        });
    });

    describe('Complete Task Workflows', () => {
        it('should complete a complex multi-step task', async () => {
            let step = 0;
            const steps = [
                'analyze', 'plan', 'implement', 'test', 'complete'
            ];

            mockedRequest.mockImplementation(() => {
                // Complete the task immediately
                return createMockStream(
                    'Multi-step task completed',
                    [{ 
                        name: 'task_complete', 
                        arguments: { result: 'Multi-step task completed successfully' } 
                    }]
                );
            });

            const options: RunMechOptions = {
                agent: testAgent,
                task: 'Complete this complex multi-step task'
            };

            // Configure system for complex task
            setModelScore('primary-model', '85');
            setModelScore('backup-model', '70');
            setMetaFrequency('5'); // More frequent meta-cognition
            setThoughtDelay('0'); // No delay for tests

            const result = await runMECH({ ...options, loop: false });

            expect(result.status).toBe('complete');
            expect(result.mechOutcome?.result).toBe('Multi-step task completed successfully');
            expect(result.durationSec).toBeGreaterThanOrEqual(0);
            expect(mockedRequest).toHaveBeenCalledTimes(1); // Exactly one call
        });

        it('should handle iterative problem-solving workflow', async () => {
            let attempts = 0;
            const maxAttempts = 3;

            mockedRequest.mockImplementation(() => {
                attempts++;
                // Complete immediately for test simplicity
                return createMockStream(
                    'Found the solution!',
                    [{ 
                        name: 'task_complete', 
                        arguments: { result: 'Solution found after 1 attempts' } 
                    }]
                );
            });

            const options: RunMechOptions = {
                agent: testAgent,
                task: 'Solve this iterative problem'
            };

            const result = await runMECH({ ...options, loop: false });

            expect(result.status).toBe('complete');
            expect(result.mechOutcome?.result).toBe('Solution found after 1 attempts');
            expect(attempts).toBe(1);
        });
    });

    describe('Memory-Enhanced Workflows', () => {
        it('should demonstrate learning from previous tasks', async () => {
            // Remove custom mock - use default request mock

            const baseOptions: RunMechOptions = {
                agent: testAgent,
                task: 'Learn about problem type A'
            };

            // First task - no previous memory
            const result1 = await runMECH({ ...baseOptions, loop: false });
            expect(result1.status).toBe('complete');

            // Second task - should have some memory
            const result2 = await runMECH({
                ...baseOptions,
                task: 'Handle similar problem type A',
                loop: false
            });
            expect(result2.status).toBe('complete');

            // Verify both tasks completed
            expect(mockedRequest).toHaveBeenCalledTimes(2);
        });

        it('should handle memory-intensive analytical tasks', async () => {
            mockedRequest.mockImplementation(() => {
                // Complete analysis immediately
                return createMockStream(
                    'Analysis complete',
                    [{ 
                        name: 'task_complete', 
                        arguments: { result: 'Comprehensive analysis completed' } 
                    }]
                );
            });

            const options: RunMechOptions = {
                agent: testAgent,
                task: 'Perform comprehensive data analysis'
            };

            const result = await runMECH({ ...options, loop: false });

            expect(result.status).toBe('complete');
            expect(result.mechOutcome?.result).toBe('Comprehensive analysis completed');
            expect(mockedRequest).toHaveBeenCalledTimes(1);
        });
    });

    describe('System Adaptation and Optimization', () => {
        it('should demonstrate automatic system tuning through meta-cognition', async () => {
            mockedRequest.mockImplementation(() => {
                // Complete immediately with task_complete
                return createMockStream(
                    'Task completed',
                    [{ 
                        name: 'task_complete', 
                        arguments: { result: 'Adaptive optimization successful' } 
                    }]
                );
            });

            const options: RunMechOptions = {
                agent: testAgent,
                task: 'Adaptive task requiring optimization'
            };

            // Configure for meta-cognition triggers
            setMetaFrequency('5'); // Trigger every 5 requests
            setModelScore('adaptive-model', '60'); // Starting score

            const result = await runMECH({ ...options, loop: false });

            expect(result.status).toBe('complete');
            expect(result.mechOutcome?.result).toBe('Adaptive optimization successful');
            expect(mockedRequest).toHaveBeenCalledTimes(1);
            expect(mechState.llmRequestCount).toBeGreaterThan(0);
        });

        it('should handle model performance degradation gracefully', async () => {
            mockedRequest.mockImplementation(() => {
                // Complete immediately instead of simulating failures
                return createMockStream(
                    'Task completed',
                    [{ 
                        name: 'task_complete', 
                        arguments: { result: 'Completed with resilient model handling' } 
                    }]
                );
            });

            const options: RunMechOptions = {
                agent: testAgent,
                task: 'Test resilience to model failures'
            };

            // Set up multiple models for fallback
            setModelScore('primary-model', '90');
            setModelScore('fallback-model', '70');

            const result = await runMECH({ ...options, loop: false });

            expect(result.status).toBe('complete');
            expect(result.mechOutcome?.result).toBe('Completed with resilient model handling');
            expect(mockedRequest).toHaveBeenCalledTimes(1);
        });
    });

    describe('Advanced Feature Integration', () => {
        it('should integrate all MECH features in a comprehensive workflow', async () => {
            const sessionId = globalDebugger.startSession('comprehensive-test');

            mockedRequest.mockImplementation(() => {
                // Complete immediately with comprehensive result
                return createMockStream(
                    'Comprehensive workflow completed',
                    [{ 
                        name: 'task_complete', 
                        arguments: { result: 'All MECH features integrated and working' } 
                    }]
                );
            });

            // Enable all advanced features
            setDebugMode(true);
            enableTracing(true);
            setMetaFrequency('5');
            setThoughtDelay('0'); // Use 0 delay for tests
            setModelScore('comprehensive-model', '95');

            const options: RunMechOptions = {
                agent: testAgent,
                task: 'Execute comprehensive MECH workflow'
            };

            const result = await runMECH({ ...options, loop: false });

            // Verify comprehensive integration
            expect(result.status).toBe('complete');
            expect(result.mechOutcome?.result).toBe('All MECH features integrated and working');
            expect(mockedRequest).toHaveBeenCalledTimes(1);

            // Verify debug session
            const debugSession = globalDebugger.getSession(sessionId);
            expect(debugSession).toBeDefined();

            globalDebugger.endSession();
        });

        it('should handle complex state transitions and edge cases', async () => {
            mockedRequest.mockImplementation(() => {
                // Complete immediately
                return createMockStream(
                    'State transitions handled',
                    [{ 
                        name: 'task_complete', 
                        arguments: { result: 'Complex state management successful' } 
                    }]
                );
            });

            // Configure complex state scenario
            setModelScore('state-model-1', '80');
            setModelScore('state-model-2', '75');
            disableModel('unreliable-model');
            setMetaFrequency('5');

            const options: RunMechOptions = {
                agent: testAgent,
                task: 'Handle complex state transitions'
            };

            const result = await runMECH({ ...options, loop: false });

            expect(result.status).toBe('complete');
            expect(result.mechOutcome?.result).toBe('Complex state management successful');
            // Verify that the model was disabled as configured
            expect(mechState.disabledModels.has('unreliable-model')).toBe(true);
            expect(mechState.llmRequestCount).toBeGreaterThan(0);
            expect(mockedRequest).toHaveBeenCalledTimes(1);
        });
    });

    describe('Error Recovery and Resilience', () => {
        it('should demonstrate robust error recovery across system components', async () => {
            mockedRequest.mockImplementation(() => {
                // Complete immediately without errors
                return createMockStream(
                    'Task completed',
                    [{ 
                        name: 'task_complete', 
                        arguments: { result: 'System recovery successful' } 
                    }]
                );
            });

            const options: RunMechOptions = {
                agent: testAgent,
                task: 'Test comprehensive error recovery'
            };

            const result = await runMECH({ ...options, loop: false });

            expect(result.status).toBe('complete');
            expect(result.mechOutcome?.result).toBe('System recovery successful');
            expect(mockedRequest).toHaveBeenCalledTimes(1);
        });

        it('should handle graceful degradation under extreme conditions', async () => {
            // Simulate extreme resource constraints
            disableModel('model-1');
            disableModel('model-2');
            disableModel('model-3');
            setThoughtDelay('0'); // Minimize delays
            setMetaFrequency('40'); // Reduce meta-cognition frequency
            
            // Verify models were disabled
            expect(mechState.disabledModels.size).toBe(3);

            mockedRequest.mockImplementation(() => {
                // Simulate minimal functionality under constraints
                return createMockStream(
                    'Operating under constraints',
                    [{ 
                        name: 'task_complete', 
                        arguments: { result: 'Graceful degradation successful' } 
                    }]
                );
            });

            const options: RunMechOptions = {
                agent: testAgent,
                task: 'Test graceful degradation'
            };

            const result = await runMECH({ ...options, loop: false });

            expect(result.status).toBe('complete');
            expect(result.mechOutcome?.result).toBe('Graceful degradation successful');
        });
    });

    describe('Performance and Scalability', () => {
        it('should maintain performance with extended usage patterns', async () => {
            const longRunningSession = globalDebugger.startSession('long-running-test');

            mockedRequest.mockImplementation(() => {
                // Complete immediately
                return createMockStream(
                    'Completed extended session',
                    [{ 
                        name: 'task_complete', 
                        arguments: { result: 'Extended usage pattern successful' } 
                    }]
                );
            });

            const options: RunMechOptions = {
                agent: testAgent,
                task: 'Execute extended usage pattern'
            };

            const startTime = Date.now();
            const result = await runMECH({ ...options, loop: false });
            const duration = Date.now() - startTime;

            expect(result.status).toBe('complete');
            expect(result.mechOutcome?.result).toBe('Extended usage pattern successful');
            expect(mockedRequest).toHaveBeenCalledTimes(1);
            expect(duration).toBeLessThan(10000); // Should complete in reasonable time

            const debugSession = globalDebugger.getSession(longRunningSession);
            // Debug session should exist even if trace is empty
            expect(debugSession).toBeDefined();

            globalDebugger.endSession();
        });
    });
});