/**
 * End-to-End Tests for MECH System
 * 
 * Tests complete MECH workflows from start to finish,
 * including real-world usage patterns and edge cases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
    runMECH, 
    runMECHWithMemory,
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
    type SimpleMechOptions,
    type SimpleMechWithMemoryOptions,
    type MechAgent
} from '../index.js';

describe('MECH End-to-End Tests', () => {
    let testAgent: MechAgent;
    
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
            created_at: new Date(),
            tools: [],
            modelClass: 'reasoning'
        };
    });

    describe('Complete Task Workflows', () => {
        it('should complete a complex multi-step task', async () => {
            let step = 0;
            const steps = [
                'analyze', 'plan', 'implement', 'test', 'complete'
            ];

            const mockRunAgent = vi.fn().mockImplementation(async (agent, input, history) => {
                const currentStep = steps[step % steps.length];
                step++;

                if (currentStep === 'complete') {
                    return {
                        response: `Completed all steps: ${steps.join(' → ')}`,
                        tool_calls: [{ 
                            name: 'task_complete', 
                            arguments: { result: 'Multi-step task completed successfully' } 
                        }]
                    };
                }

                return {
                    response: `Working on step: ${currentStep}. Progress: ${step}/${steps.length}`,
                    tool_calls: []
                };
            });

            const options: SimpleMechOptions = {
                runAgent: mockRunAgent
            };

            // Configure system for complex task
            setModelScore('primary-model', '85');
            setModelScore('backup-model', '70');
            setMetaFrequency('3'); // More frequent meta-cognition
            setThoughtDelay('1'); // Small delay for realism

            const result = await runMECH(testAgent, 'Complete this complex multi-step task', options);

            expect(result.status).toBe('complete');
            expect(result.mechOutcome?.result).toContain('Multi-step task completed successfully');
            expect(result.durationSec).toBeGreaterThan(0);
            expect(mockRunAgent).toHaveBeenCalledTimes(5); // One call per step
        });

        it('should handle iterative problem-solving workflow', async () => {
            let attempts = 0;
            const maxAttempts = 3;

            const mockRunAgent = vi.fn().mockImplementation(async (agent, input, history) => {
                attempts++;
                
                if (attempts < maxAttempts) {
                    return {
                        response: `Attempt ${attempts}: Need to refine approach`,
                        tool_calls: []
                    };
                } else {
                    return {
                        response: `Attempt ${attempts}: Found the solution!`,
                        tool_calls: [{ 
                            name: 'task_complete', 
                            arguments: { result: `Solution found after ${attempts} attempts` } 
                        }]
                    };
                }
            });

            const options: SimpleMechOptions = {
                runAgent: mockRunAgent
            };

            const result = await runMECH(testAgent, 'Solve this iterative problem', options);

            expect(result.status).toBe('complete');
            expect(result.mechOutcome?.result).toContain('Solution found after 3 attempts');
            expect(attempts).toBe(maxAttempts);
        });
    });

    describe('Memory-Enhanced Workflows', () => {
        it('should demonstrate learning from previous tasks', async () => {
            const conversations: string[] = [];

            const mockRunAgent = vi.fn().mockImplementation(async (agent, input, history) => {
                // Simulate learning from history
                const previousLearning = history.filter(h => h.role === 'developer' && h.content?.includes('MEMORY'));
                
                let response = `Processing task: ${input}`;
                if (previousLearning.length > 0) {
                    response += ` (Using knowledge from ${previousLearning.length} previous experiences)`;
                }

                conversations.push(response);

                return {
                    response,
                    tool_calls: [{ 
                        name: 'task_complete', 
                        arguments: { result: 'Task completed with memory enhancement' } 
                    }]
                };
            });

            const baseOptions: SimpleMechWithMemoryOptions = {
                runAgent: mockRunAgent,
                taskId: 'learning-test',
                taskDescription: 'Learning and memory test scenario'
            };

            // First task - no previous memory
            const result1 = await runMECHWithMemory(testAgent, 'Learn about problem type A', baseOptions);
            expect(result1.status).toBe('complete');

            // Second task - should have some memory
            const result2 = await runMECHWithMemory(testAgent, 'Handle similar problem type A', {
                ...baseOptions,
                taskId: 'learning-test-2'
            });
            expect(result2.status).toBe('complete');

            // Verify learning progression
            expect(conversations.length).toBe(2);
            expect(mockRunAgent).toHaveBeenCalledTimes(2);
        });

        it('should handle memory-intensive analytical tasks', async () => {
            const analysisSteps = [
                'data_collection',
                'pattern_analysis', 
                'hypothesis_formation',
                'validation',
                'conclusion'
            ];

            let currentStep = 0;

            const mockRunAgent = vi.fn().mockImplementation(async (agent, input, history) => {
                const step = analysisSteps[currentStep];
                currentStep++;

                if (step === 'conclusion') {
                    return {
                        response: `Analysis complete. Processed ${analysisSteps.length} steps with full memory context.`,
                        tool_calls: [{ 
                            name: 'task_complete', 
                            arguments: { result: 'Comprehensive analysis completed' } 
                        }]
                    };
                }

                return {
                    response: `Executing ${step} with access to ${history.length} previous interactions`,
                    tool_calls: []
                };
            });

            const options: SimpleMechWithMemoryOptions = {
                runAgent: mockRunAgent,
                taskId: 'complex-analysis',
                taskDescription: 'Multi-step analytical task requiring memory'
            };

            const result = await runMECHWithMemory(testAgent, 'Perform comprehensive data analysis', options);

            expect(result.status).toBe('complete');
            expect(result.mechOutcome?.result).toContain('Comprehensive analysis completed');
            expect(currentStep).toBe(analysisSteps.length);
        });
    });

    describe('System Adaptation and Optimization', () => {
        it('should demonstrate automatic system tuning through meta-cognition', async () => {
            let metacognitionTriggered = false;
            const responses: string[] = [];

            const mockRunAgent = vi.fn().mockImplementation(async (agent, input, history) => {
                responses.push(input);

                // Check for meta-cognition injection
                const metaThoughts = history.filter(h => h.content?.includes('METACOGNITION'));
                if (metaThoughts.length > 0) {
                    metacognitionTriggered = true;
                }

                if (responses.length >= 5) {
                    return {
                        response: 'Task sequence completed with system optimization',
                        tool_calls: [{ 
                            name: 'task_complete', 
                            arguments: { result: 'Adaptive optimization successful' } 
                        }]
                    };
                }

                return {
                    response: `Processing request ${responses.length}: ${input}`,
                    tool_calls: []
                };
            });

            const options: SimpleMechOptions = {
                runAgent: mockRunAgent
            };

            // Configure for meta-cognition triggers
            setMetaFrequency('2'); // Trigger every 2 requests
            setModelScore('adaptive-model', '60'); // Starting score

            const result = await runMECH(testAgent, 'Adaptive task requiring optimization', options);

            expect(result.status).toBe('complete');
            expect(responses.length).toBeGreaterThanOrEqual(5);
            expect(mechState.llmRequestCount).toBeGreaterThan(0);
        });

        it('should handle model performance degradation gracefully', async () => {
            let callCount = 0;

            const mockRunAgent = vi.fn().mockImplementation(async (agent, input, history) => {
                callCount++;

                // Simulate model degradation
                if (callCount <= 2) {
                    throw new Error('Model temporarily unavailable');
                } else {
                    return {
                        response: 'Recovered with fallback model',
                        tool_calls: [{ 
                            name: 'task_complete', 
                            arguments: { result: 'Completed with resilient model handling' } 
                        }]
                    };
                }
            });

            const options: SimpleMechOptions = {
                runAgent: mockRunAgent
            };

            // Set up multiple models for fallback
            setModelScore('primary-model', '90');
            setModelScore('fallback-model', '70');

            const result = await runMECH(testAgent, 'Test resilience to model failures', options);

            expect(result.status).toBe('complete');
            expect(callCount).toBeGreaterThan(2); // Should have retried
            expect(result.mechOutcome?.result).toContain('Completed with resilient model handling');
        });
    });

    describe('Advanced Feature Integration', () => {
        it('should integrate all MECH features in a comprehensive workflow', async () => {
            let interactions = 0;
            const sessionId = globalDebugger.startSession('comprehensive-test');

            const mockRunAgent = vi.fn().mockImplementation(async (agent, input, history) => {
                interactions++;

                // Simulate complex decision making
                if (interactions === 1) {
                    return { response: 'Initializing comprehensive workflow', tool_calls: [] };
                } else if (interactions === 2) {
                    return { response: 'Analyzing requirements with memory context', tool_calls: [] };
                } else if (interactions === 3) {
                    return { response: 'Implementing solution with optimized approach', tool_calls: [] };
                } else {
                    return {
                        response: 'Comprehensive workflow completed successfully',
                        tool_calls: [{ 
                            name: 'task_complete', 
                            arguments: { result: 'All MECH features integrated and working' } 
                        }]
                    };
                }
            });

            // Enable all advanced features
            setDebugMode(true);
            enableTracing(true);
            setMetaFrequency('2');
            setThoughtDelay('1');
            setModelScore('comprehensive-model', '95');

            const options: SimpleMechWithMemoryOptions = {
                runAgent: mockRunAgent,
                taskId: 'comprehensive-test',
                taskDescription: 'Full feature integration test'
            };

            const result = await runMECHWithMemory(testAgent, 'Execute comprehensive MECH workflow', options);

            // Verify comprehensive integration
            expect(result.status).toBe('complete');
            expect(result.mechOutcome?.result).toContain('All MECH features integrated and working');
            expect(interactions).toBe(4);

            // Verify debug session
            const debugSession = globalDebugger.getSession(sessionId);
            expect(debugSession).toBeDefined();
            expect(debugSession?.executionTrace.length).toBeGreaterThan(0);

            globalDebugger.endSession();
        });

        it('should handle complex state transitions and edge cases', async () => {
            const stateTransitions: string[] = [];

            const mockRunAgent = vi.fn().mockImplementation(async (agent, input, history) => {
                // Simulate various state transitions
                if (mechState.llmRequestCount < 2) {
                    stateTransitions.push('initializing');
                    return { response: 'System initializing', tool_calls: [] };
                } else if (mechState.llmRequestCount < 4) {
                    stateTransitions.push('processing');
                    return { response: 'Processing complex request', tool_calls: [] };
                } else {
                    stateTransitions.push('completing');
                    return {
                        response: 'State transitions handled successfully',
                        tool_calls: [{ 
                            name: 'task_complete', 
                            arguments: { result: 'Complex state management successful' } 
                        }]
                    };
                }
            });

            // Configure complex state scenario
            setModelScore('state-model-1', '80');
            setModelScore('state-model-2', '75');
            disableModel('unreliable-model');
            setMetaFrequency('3');

            const options: SimpleMechOptions = {
                runAgent: mockRunAgent
            };

            const result = await runMECH(testAgent, 'Handle complex state transitions', options);

            expect(result.status).toBe('complete');
            expect(stateTransitions).toEqual(['initializing', 'processing', 'completing']);
            expect(mechState.disabledModels.has('unreliable-model')).toBe(true);
            expect(mechState.llmRequestCount).toBeGreaterThan(0);
        });
    });

    describe('Error Recovery and Resilience', () => {
        it('should demonstrate robust error recovery across system components', async () => {
            let errorPhase = true;
            let recoveryAttempts = 0;

            const mockRunAgent = vi.fn().mockImplementation(async (agent, input, history) => {
                recoveryAttempts++;

                if (errorPhase && recoveryAttempts <= 2) {
                    throw new Error(`Simulated system error ${recoveryAttempts}`);
                }

                errorPhase = false;
                return {
                    response: `Recovered after ${recoveryAttempts} attempts`,
                    tool_calls: [{ 
                        name: 'task_complete', 
                        arguments: { result: 'System recovery successful' } 
                    }]
                };
            });

            const options: SimpleMechOptions = {
                runAgent: mockRunAgent
            };

            const result = await runMECH(testAgent, 'Test comprehensive error recovery', options);

            expect(result.status).toBe('complete');
            expect(recoveryAttempts).toBe(3); // 2 errors + 1 success
            expect(result.mechOutcome?.result).toContain('System recovery successful');
        });

        it('should handle graceful degradation under extreme conditions', async () => {
            // Simulate extreme resource constraints
            disableModel('model-1');
            disableModel('model-2');
            disableModel('model-3');
            setThoughtDelay('0'); // Minimize delays
            setMetaFrequency('40'); // Reduce meta-cognition frequency

            const mockRunAgent = vi.fn().mockImplementation(async (agent, input, history) => {
                // Simulate minimal functionality under constraints
                return {
                    response: 'Operating under constrained conditions',
                    tool_calls: [{ 
                        name: 'task_complete', 
                        arguments: { result: 'Graceful degradation successful' } 
                    }]
                };
            });

            const options: SimpleMechOptions = {
                runAgent: mockRunAgent
            };

            const result = await runMECH(testAgent, 'Test graceful degradation', options);

            expect(result.status).toBe('complete');
            expect(result.mechOutcome?.result).toContain('Graceful degradation successful');
            expect(mechState.disabledModels.size).toBe(3);
        });
    });

    describe('Performance and Scalability', () => {
        it('should maintain performance with extended usage patterns', async () => {
            const longRunningSession = globalDebugger.startSession('long-running-test');
            let totalInteractions = 0;

            const mockRunAgent = vi.fn().mockImplementation(async (agent, input, history) => {
                totalInteractions++;
                
                if (totalInteractions >= 10) {
                    return {
                        response: `Completed extended session with ${totalInteractions} interactions`,
                        tool_calls: [{ 
                            name: 'task_complete', 
                            arguments: { result: 'Extended usage pattern successful' } 
                        }]
                    };
                }

                return {
                    response: `Interaction ${totalInteractions}: Processing request`,
                    tool_calls: []
                };
            });

            const options: SimpleMechOptions = {
                runAgent: mockRunAgent
            };

            const startTime = Date.now();
            const result = await runMECH(testAgent, 'Execute extended usage pattern', options);
            const duration = Date.now() - startTime;

            expect(result.status).toBe('complete');
            expect(totalInteractions).toBe(10);
            expect(duration).toBeLessThan(10000); // Should complete in reasonable time

            const debugSession = globalDebugger.getSession(longRunningSession);
            expect(debugSession?.executionTrace.length).toBeGreaterThan(0);

            globalDebugger.endSession();
        });
    });
});