/**
 * Integration Tests for MECH System
 * 
 * Tests the complete MECH workflow including model rotation,
 * meta-cognition, thought delays, and state management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
    runMECH, 
    runMECHWithMemory,
    setModelScore,
    setMetaFrequency,
    setThoughtDelay,
    mechState,
    resetLLMRequestCount,
    getTotalCost,
    resetCostTracker,
    type SimpleAgent,
    type RunMechOptions,
    type SimpleMechWithMemoryOptions
} from '../index.js';
import { createFullContext } from '../utils/internal_utils.js';

// Helper to create mock runAgent functions with proper signature
function createMockRunAgent(impl: (agent: any, input: string, history: any[]) => Promise<any>) {
    // Create a function with exactly 3 parameters to satisfy validation
    const mockFn = function(agent: any, input: string, history: any[]) {
        return impl(agent, input, history);
    };
    return vi.fn(mockFn);
}

describe('MECH Integration Tests', () => {
    let mockAgent: SimpleAgent;
    let mockRunAgent: ReturnType<typeof createMockRunAgent>;
    
    beforeEach(() => {
        // Reset MECH state
        resetLLMRequestCount();
        resetCostTracker();
        mechState.disabledModels.clear();
        mechState.modelScores = {};
        mechState.metaFrequency = '5';
        
        // Create mock agent
        mockAgent = {
            name: 'IntegrationTestAgent',
            agent_id: 'integration-test-' + Date.now(),
            tools: [],
            modelClass: 'reasoning'
        };
        
        // Mock runAgent function that simulates LLM responses
        mockRunAgent = createMockRunAgent(async (agent, input, history) => {
            // Check history for task content since input is empty
            const taskContent = history.find(h => h.role === 'user')?.content || '';
            
            // Always complete immediately to match MECH behavior
            if (taskContent.includes('error')) {
                return {
                    response: 'I encountered an error.',
                    tool_calls: [{ name: 'task_fatal_error', arguments: { error: 'Simulated error' } }]
                };
            } else {
                return {
                    response: 'I will complete this task now.',
                    tool_calls: [{ name: 'task_complete', arguments: { result: 'Task completed successfully' } }]
                };
            }
        });
    });

    describe('Complete MECH Workflow', () => {
        it('should run a complete task with model rotation and meta-cognition', async () => {
            // Set up some model scores to test rotation
            setModelScore('test-model-1', '80');
            setModelScore('test-model-2', '60');
            setMetaFrequency('5'); // Trigger meta-cognition after 5 requests

            const options: RunMechOptions = {
                agent: mockAgent,
                task: 'Please complete this integration test',
                runAgent: mockRunAgent
            };

            const result = await runMECH(options);

            expect(result).toBeDefined();
            expect(result.status).toBe('complete');
            expect(result.durationSec).toBeGreaterThanOrEqual(0);
            expect(result.history).toBeDefined();
            expect(result.history.length).toBeGreaterThan(0);
            
            // Verify agent was called
            expect(mockRunAgent).toHaveBeenCalled();
            
            // Verify MECH state was updated
            expect(mechState.llmRequestCount).toBeGreaterThan(0);
        });

        it('should handle task completion flow correctly', async () => {
            const options: RunMechOptions = {
                agent: mockAgent,
                task: 'Please complete this task',
                runAgent: mockRunAgent
            };

            const result = await runMECH(options);

            expect(result.status).toBe('complete');
            expect(result.mechOutcome?.status).toBe('complete');
            expect(result.mechOutcome?.result).toBe('I will complete this task now.');
        });

        it('should handle error scenarios gracefully', async () => {
            // Create a specific error-handling mock that throws an error
            const errorRunAgent = createMockRunAgent(async (agent, input, history) => {
                throw new Error('Simulated error');
            });
            
            const options: RunMechOptions = {
                agent: mockAgent,
                task: 'Please error out',
                runAgent: errorRunAgent
            };

            const result = await runMECH(options);

            expect(result.status).toBe('fatal_error');
            expect(result.mechOutcome?.status).toBe('fatal_error');
            expect(result.mechOutcome?.error).toContain('Simulated error');
        });
    });

    describe('Memory Integration', () => {
        it('should run MECH with memory successfully', async () => {
            const mockEmbed = async (text: string) => {
                return Array(1536).fill(0).map(() => Math.random());
            };

            const options: SimpleMechWithMemoryOptions = {
                agent: mockAgent,
                task: 'Remember this task',
                runAgent: mockRunAgent,
                embed: mockEmbed
            };

            const result = await runMECHWithMemory(options);

            expect(result).toBeDefined();
            expect(result.status).toBe('complete');
            expect(mockRunAgent).toHaveBeenCalledTimes(1);
        });

        it('should provide memory context to agents', async () => {
            let receivedHistory: any[] = [];
            
            const mockRunAgentWithMemory = createMockRunAgent(async (agent, input, history) => {
                receivedHistory = history;
                return {
                    response: 'Task completed with memory',
                    tool_calls: [{ name: 'task_complete', arguments: { result: 'Memory integration successful' } }]
                };
            });

            const mockEmbed = async (text: string) => {
                return Array(1536).fill(0).map(() => Math.random());
            };

            const options: SimpleMechWithMemoryOptions = {
                agent: mockAgent,
                task: 'Use memory for this task',
                runAgent: mockRunAgentWithMemory,
                embed: mockEmbed
            };

            await runMECHWithMemory(options);

            expect(mockRunAgentWithMemory).toHaveBeenCalled();
            expect(receivedHistory).toBeDefined();
            expect(receivedHistory.length).toBeGreaterThan(0);
        });
    });

    describe('State Management Integration', () => {
        it('should reset state for each MECH run', async () => {
            const options: RunMechOptions = {
                agent: mockAgent,
                task: 'First task',
                runAgent: mockRunAgent
            };

            // Set model score before first run
            setModelScore('test-model', '90');
            
            // First run
            await runMECH(options);
            
            // State should be reset, so score will be cleared
            expect(mechState.modelScores).toEqual({});
            expect(mechState.llmRequestCount).toBe(1);
        });

        it('should track request count within a single run', async () => {
            const options: RunMechOptions = {
                agent: mockAgent,
                task: 'Task 1',
                runAgent: mockRunAgent
            };

            setMetaFrequency('5'); // Trigger after 5 requests
            
            // Run once
            await runMECH(options);
            
            // Within a single run, count should be 1 (since we complete immediately)
            expect(mechState.llmRequestCount).toBe(1);
            
            // Run again - count resets
            await runMECH({
                ...options,
                task: 'Task 2'
            });
            
            // Count resets for each run
            expect(mechState.llmRequestCount).toBe(1);
        });
    });

    describe('Context Creation and Management', () => {
        it('should create full context from simple options correctly', () => {
            const simpleOptions = {
                runAgent: mockRunAgent,
                agent: mockAgent
            };

            const context = createFullContext(simpleOptions);

            expect(context).toBeDefined();
            expect(context.runStreamedWithTools).toBeDefined();
            expect(context.sendComms).toBeDefined();
            expect(context.getCommunicationManager).toBeDefined();
            expect(context.addHistory).toBeDefined();
            expect(context.getHistory).toBeDefined();
            expect(context.costTracker).toBeDefined();
            expect(context.createToolFunction).toBeDefined();
        });

        it('should handle communication flow correctly', async () => {
            const messages: any[] = [];
            const mockSendComms = vi.fn().mockImplementation((msg) => {
                messages.push(msg);
            });

            const options: RunMechOptions = {
                agent: mockAgent,
                task: 'Test communication',
                runAgent: mockRunAgent,
                onStatus: mockSendComms
            };

            await runMECH(options);

            expect(mockSendComms).toHaveBeenCalled();
            expect(messages.length).toBeGreaterThan(0);
            
            // Should have agent status messages
            const statusMessages = messages.filter(m => m.type === 'agent_status');
            expect(statusMessages.length).toBeGreaterThan(0);
        });
    });

    describe('Cost Tracking Integration', () => {
        it('should track costs across MECH operations', async () => {
            resetCostTracker();
            const initialCost = getTotalCost();

            const options: RunMechOptions = {
                agent: mockAgent,
                task: 'Track costs',
                runAgent: mockRunAgent
            };

            const result = await runMECH(options);

            expect(result.totalCost).toBeGreaterThanOrEqual(0);
            expect(getTotalCost()).toBeGreaterThanOrEqual(initialCost);
        });

        it('should provide accurate cost reporting in results', async () => {
            resetCostTracker();

            const options: RunMechOptions = {
                agent: mockAgent,
                task: 'Cost reporting test',
                runAgent: mockRunAgent
            };

            const result = await runMECH(options);

            expect(result.totalCost).toBeDefined();
            expect(typeof result.totalCost).toBe('number');
            expect(result.totalCost).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Thought Delay Integration', () => {
        it('should complete quickly when task_complete is called immediately', async () => {
            setThoughtDelay('2'); // 2 second delay

            const options: RunMechOptions = {
                agent: mockAgent,
                task: 'Test with delay',
                runAgent: mockRunAgent
            };

            const startTime = Date.now();
            await runMECH(options);
            const duration = Date.now() - startTime;

            // Should complete quickly since task_complete is called immediately
            expect(duration).toBeLessThan(3000); // Less than 3 seconds
        });

        it('should allow delay interruption', async () => {
            setThoughtDelay('8'); // Long delay to test interruption

            const quickRunAgent = function(agent: any, input: string, history: any[]) {
                // Simulate quick completion
                return Promise.resolve({
                    response: 'Quick response',
                    tool_calls: [{ name: 'task_complete', arguments: { result: 'Quick completion' } }]
                });
            };

            const options: RunMechOptions = {
                agent: mockAgent,
                task: 'Quick task',
                runAgent: quickRunAgent
            };

            const startTime = Date.now();
            const result = await runMECH(options);
            const duration = Date.now() - startTime;

            expect(result.status).toBe('complete');
            // Should not wait full 8 seconds due to quick completion
            expect(duration).toBeLessThan(8000);
        });
    });

    describe('Error Handling Integration', () => {
        it('should handle agent execution errors gracefully', async () => {
            const failingRunAgent = createMockRunAgent(async () => {
                throw new Error('Agent execution failed');
            });

            const options: RunMechOptions = {
                agent: mockAgent,
                task: 'This will fail',
                runAgent: failingRunAgent
            };

            const result = await runMECH(options);

            expect(result.status).toBe('fatal_error');
            expect(result.mechOutcome?.error).toContain('Agent execution failed');
        });

        it('should provide detailed error information', async () => {
            const specificError = new Error('Specific integration test error');
            const failingRunAgent = createMockRunAgent(async () => {
                throw specificError;
            });

            const options: RunMechOptions = {
                agent: mockAgent,
                task: 'Specific error test',
                runAgent: failingRunAgent
            };

            const result = await runMECH(options);

            expect(result.status).toBe('fatal_error');
            expect(result.mechOutcome?.error).toContain('Specific integration test error');
            expect(result.durationSec).toBeGreaterThanOrEqual(0);
            expect(result.totalCost).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Tool Integration', () => {
        it('should provide MECH tools to agents', async () => {
            let receivedAgent: any = null;

            const toolAwareRunAgent = createMockRunAgent(async (agent, input, history) => {
                receivedAgent = agent;
                return {
                    response: 'Tools received',
                    tool_calls: [{ name: 'task_complete', arguments: { result: 'Tool integration successful' } }]
                };
            });

            const options: RunMechOptions = {
                agent: mockAgent,
                task: 'Test tool integration',
                runAgent: toolAwareRunAgent
            };

            await runMECH(options);

            expect(toolAwareRunAgent).toHaveBeenCalled();
            expect(receivedAgent).toBeDefined();
            expect(receivedAgent.tools).toBeDefined();
            expect(receivedAgent.tools.length).toBeGreaterThan(0);
            
            // Should have core MECH tools - check tool function names
            const toolNames = receivedAgent.tools.map((t: any) => {
                // Handle different tool structures
                return t.definition?.function?.name || 
                       (t.function as any)?.name || 
                       t.name || 
                       'unknown';
            });
            expect(toolNames).toContain('task_complete');
            expect(toolNames).toContain('task_fatal_error');
        });

        it('should provide MECH tools via simple API', async () => {
            // The simple API doesn't preserve custom tools - it only adds MECH tools
            let receivedAgent: any = null;

            const toolAwareRunAgent = createMockRunAgent(async (agent, input, history) => {
                receivedAgent = agent;
                return {
                    response: 'MECH tools provided',
                    tool_calls: [{ name: 'task_complete', arguments: { result: 'Simple API tool test' } }]
                };
            });

            const options: RunMechOptions = {
                agent: mockAgent,
                task: 'Test MECH tools via simple API',
                runAgent: toolAwareRunAgent
            };

            await runMECH(options);

            expect(receivedAgent).toBeDefined();
            expect(receivedAgent.tools).toBeDefined();
            
            // Should have MECH tools
            const toolNames = receivedAgent.tools.map((t: any) => {
                // Handle different tool structures
                return t.definition?.function?.name || 
                       (t.function as any)?.name || 
                       t.name || 
                       'unknown';
            });
            
            // Should have core MECH tools
            expect(toolNames).toContain('task_complete'); // MECH tool
            expect(toolNames).toContain('task_fatal_error'); // MECH tool
            
            // Verify we have at least 2 MECH tools
            expect(toolNames.length).toBeGreaterThanOrEqual(2);
        });
    });
});