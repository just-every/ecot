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

describe('MECH Integration Tests', () => {
    let mockAgent: SimpleAgent;
    let mockRunAgent: (agent: any, input: string, history: any[]) => Promise<{ response: string; tool_calls?: any[] }>;
    
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
            agent_id: 'integration-test-' + Date.now()
        };
        
        // Mock runAgent function that simulates LLM responses
        mockRunAgent = vi.fn().mockImplementation(async (agent, input, history) => {
            // Simulate different responses based on input
            if (input.includes('complete')) {
                return {
                    response: 'I will complete this task now.',
                    tool_calls: [{ name: 'task_complete', arguments: { result: 'Task completed successfully' } }]
                };
            } else if (input.includes('error')) {
                return {
                    response: 'I encountered an error.',
                    tool_calls: [{ name: 'task_fatal_error', arguments: { error: 'Simulated error' } }]
                };
            } else {
                return {
                    response: 'I am working on the task: ' + input,
                    tool_calls: []
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
            expect(result.durationSec).toBeGreaterThan(0);
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
            expect(result.mechOutcome?.result).toContain('Task completed successfully');
        });

        it('should handle error scenarios gracefully', async () => {
            const options: RunMechOptions = {
                agent: mockAgent,
                task: 'Please error out',
                runAgent: mockRunAgent
            };

            const result = await runMECH(options);

            expect(result.status).toBe('fatal_error');
            expect(result.mechOutcome?.status).toBe('fatal_error');
            expect(result.mechOutcome?.error).toContain('Simulated error');
        });
    });

    describe('Memory Integration', () => {
        it('should run MECH with memory successfully', async () => {
            const options: SimpleMechWithMemoryOptions = {
                runAgent: mockRunAgent,
                taskId: 'integration-test-memory',
                taskDescription: 'Integration test with memory'
            };

            const result = await runMECHWithMemory(mockAgent, 'Remember this task', options);

            expect(result).toBeDefined();
            expect(result.status).toBe('complete');
            expect(mockRunAgent).toHaveBeenCalled();
        });

        it('should provide memory context to agents', async () => {
            let receivedHistory: any[] = [];
            
            const mockRunAgentWithMemory = vi.fn().mockImplementation(async (agent, input, history) => {
                receivedHistory = history;
                return {
                    response: 'Task completed with memory',
                    tool_calls: [{ name: 'task_complete', arguments: { result: 'Memory integration successful' } }]
                };
            });

            const options: SimpleMechWithMemoryOptions = {
                runAgent: mockRunAgentWithMemory,
                taskId: 'memory-context-test',
                taskDescription: 'Test memory context provision'
            };

            await runMECHWithMemory(mockAgent, 'Use memory for this task', options);

            expect(mockRunAgentWithMemory).toHaveBeenCalled();
            expect(receivedHistory).toBeDefined();
            expect(receivedHistory.length).toBeGreaterThan(0);
        });
    });

    describe('State Management Integration', () => {
        it('should maintain state across multiple MECH runs', async () => {
            const options: SimpleMechOptions = {
                runAgent: mockRunAgent
            };

            // First run
            setModelScore('persistent-model', '90');
            await runMECH(mockAgent, 'First task', options);
            const firstRequestCount = mechState.llmRequestCount;

            // Second run
            await runMECH(mockAgent, 'Second task', options);
            const secondRequestCount = mechState.llmRequestCount;

            expect(secondRequestCount).toBeGreaterThan(firstRequestCount);
            expect(mechState.modelScores['persistent-model']).toBe(90);
        });

        it('should trigger meta-cognition based on frequency', async () => {
            const options: SimpleMechOptions = {
                runAgent: mockRunAgent
            };

            setMetaFrequency('2'); // Trigger after 2 requests
            
            // Mock the meta-cognition behavior
            const metaSpy = vi.fn();
            
            // Run multiple times to trigger meta-cognition
            await runMECH(mockAgent, 'Task 1', options);
            await runMECH(mockAgent, 'Task 2', options);

            expect(mechState.llmRequestCount).toBe(2);
        });
    });

    describe('Context Creation and Management', () => {
        it('should create full context from simple options correctly', () => {
            const simpleOptions: SimpleMechOptions = {
                runAgent: mockRunAgent
            };

            const context = createFullContext(simpleOptions);

            expect(context).toBeDefined();
            expect(context.runAgent).toBe(mockRunAgent);
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

            const options: SimpleMechOptions = {
                runAgent: mockRunAgent,
                sendComms: mockSendComms
            };

            await runMECH(mockAgent, 'Test communication', options);

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

            const options: SimpleMechOptions = {
                runAgent: mockRunAgent
            };

            const result = await runMECH(mockAgent, 'Track costs', options);

            expect(result.totalCost).toBeGreaterThanOrEqual(0);
            expect(getTotalCost()).toBeGreaterThanOrEqual(initialCost);
        });

        it('should provide accurate cost reporting in results', async () => {
            resetCostTracker();

            const options: SimpleMechOptions = {
                runAgent: mockRunAgent
            };

            const result = await runMECH(mockAgent, 'Cost reporting test', options);

            expect(result.totalCost).toBeDefined();
            expect(typeof result.totalCost).toBe('number');
            expect(result.totalCost).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Thought Delay Integration', () => {
        it('should respect thought delay settings', async () => {
            setThoughtDelay('2'); // 2 second delay

            const options: SimpleMechOptions = {
                runAgent: mockRunAgent
            };

            const startTime = Date.now();
            await runMECH(mockAgent, 'Test with delay', options);
            const duration = Date.now() - startTime;

            // Should take at least some time due to delay
            expect(duration).toBeGreaterThan(1000); // At least 1 second
        });

        it('should allow delay interruption', async () => {
            setThoughtDelay('8'); // Long delay to test interruption

            const options: SimpleMechOptions = {
                runAgent: async (agent, input, history) => {
                    // Simulate quick completion
                    return {
                        response: 'Quick response',
                        tool_calls: [{ name: 'task_complete', arguments: { result: 'Quick completion' } }]
                    };
                }
            };

            const startTime = Date.now();
            const result = await runMECH(mockAgent, 'Quick task', options);
            const duration = Date.now() - startTime;

            expect(result.status).toBe('complete');
            // Should not wait full 8 seconds due to quick completion
            expect(duration).toBeLessThan(8000);
        });
    });

    describe('Error Handling Integration', () => {
        it('should handle agent execution errors gracefully', async () => {
            const failingRunAgent = vi.fn().mockRejectedValue(new Error('Agent execution failed'));

            const options: SimpleMechOptions = {
                runAgent: failingRunAgent
            };

            const result = await runMECH(mockAgent, 'This will fail', options);

            expect(result.status).toBe('fatal_error');
            expect(result.mechOutcome?.error).toContain('Agent execution failed');
        });

        it('should provide detailed error information', async () => {
            const specificError = new Error('Specific integration test error');
            const failingRunAgent = vi.fn().mockRejectedValue(specificError);

            const options: SimpleMechOptions = {
                runAgent: failingRunAgent
            };

            const result = await runMECH(mockAgent, 'Specific error test', options);

            expect(result.status).toBe('fatal_error');
            expect(result.mechOutcome?.error).toContain('Specific integration test error');
            expect(result.durationSec).toBeGreaterThan(0);
            expect(result.totalCost).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Tool Integration', () => {
        it('should provide MECH tools to agents', async () => {
            let receivedTools: any[] = [];

            const toolAwareRunAgent = vi.fn().mockImplementation(async (agent, input, history) => {
                receivedTools = agent.tools || [];
                return {
                    response: 'Tools received',
                    tool_calls: [{ name: 'task_complete', arguments: { result: 'Tool integration successful' } }]
                };
            });

            const options: SimpleMechOptions = {
                runAgent: toolAwareRunAgent
            };

            await runMECH(mockAgent, 'Test tool integration', options);

            expect(toolAwareRunAgent).toHaveBeenCalled();
            expect(receivedTools).toBeDefined();
            expect(receivedTools.length).toBeGreaterThan(0);
            
            // Should have core MECH tools
            const toolNames = receivedTools.map(t => t.name);
            expect(toolNames).toContain('task_complete');
            expect(toolNames).toContain('task_fatal_error');
        });

        it('should merge custom tools with MECH tools', async () => {
            const customTool = {
                name: 'custom_test_tool',
                description: 'A custom tool for testing',
                parameters: {}
            };

            mockAgent.tools = [customTool];

            let receivedTools: any[] = [];

            const toolAwareRunAgent = vi.fn().mockImplementation(async (agent, input, history) => {
                receivedTools = agent.tools || [];
                return {
                    response: 'Custom tools merged',
                    tool_calls: [{ name: 'task_complete', arguments: { result: 'Custom tool integration successful' } }]
                };
            });

            const options: SimpleMechOptions = {
                runAgent: toolAwareRunAgent
            };

            await runMECH(mockAgent, 'Test custom tool integration', options);

            const toolNames = receivedTools.map(t => t.name);
            expect(toolNames).toContain('custom_test_tool'); // Custom tool
            expect(toolNames).toContain('task_complete'); // MECH tool
        });
    });
});