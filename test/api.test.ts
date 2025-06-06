import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runMECH } from '../src/core/engine.js';
import { Agent } from '@just-every/ensemble';

// Mock ensemble
vi.mock('@just-every/ensemble', () => ({
    Agent: vi.fn().mockImplementation((def) => ({
        ...def,
        agent_id: def.agent_id || 'test-agent',
        name: def.name || 'TestAgent',
        tools: def.tools || []
    })),
    cloneAgent: vi.fn().mockImplementation((agent) => ({
        ...agent,
        agent_id: agent.agent_id || 'test-agent',
        name: agent.name || 'TestAgent',
        tools: agent.tools || []
    })),
    ensembleRequest: vi.fn().mockImplementation(async function* () {
        // First yield a message delta
        yield {
            type: 'message_delta',
            content: 'Processing task...'
        };
        
        // Then yield the tool call for task_complete
        yield {
            type: 'tool_done',
            tool_call: {
                function: {
                    name: 'task_complete'
                }
            },
            result: {
                output: 'Task completed successfully'
            }
        };
        
        // Finally yield the response output
        yield {
            type: 'response_output',
            message: {
                type: 'message',
                role: 'assistant',
                content: 'Task has been completed.'
            }
        };
    }),
    createToolFunction: vi.fn((fn, desc, params, returns, name) => ({
        function: fn,
        definition: {
            type: 'function',
            function: {
                name: name || fn.name || 'anonymous',
                description: desc,
                parameters: {
                    type: 'object',
                    properties: params || {},
                    required: []
                }
            }
        }
    })),
    CostTracker: vi.fn().mockImplementation(() => ({
        getTotalCost: () => 0.01,
        addUsage: vi.fn()
    })),
    getModelFromClass: vi.fn().mockResolvedValue('gpt-4')
}));


describe('MECH API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('runMECH', () => {
        it('should validate agent parameter', async () => {
            const gen1 = runMECH(null as any, 'test');
            await expect(gen1.next()).rejects.toThrow('Agent must be a valid Agent instance');
            
            const gen2 = runMECH('not an agent' as any, 'test');
            await expect(gen2.next()).rejects.toThrow('Agent must be a valid Agent instance');
        });

        it('should validate content parameter', async () => {
            const agent = new Agent({ name: 'TestAgent' });
            
            const gen1 = runMECH(agent, null as any);
            await expect(gen1.next()).rejects.toThrow('Content must be a non-empty string');
            
            const gen2 = runMECH(agent, '');
            await expect(gen2.next()).rejects.toThrow('Content must be a non-empty string');
            
            const gen3 = runMECH(agent, '   ');
            await expect(gen3.next()).rejects.toThrow('Content must be a non-empty string');
        });

        it('should successfully run a simple task', async () => {
            const agent = new Agent({ 
                name: 'TestAgent',
                instructions: 'You are a test agent'
            });
            
            const events = [];
            for await (const event of runMECH(agent, 'Complete this test task')) {
                events.push(event);
            }
            
            // Should have yielded all events
            expect(events).toHaveLength(3);
            expect(events[0]).toMatchObject({
                type: 'message_delta',
                content: 'Processing task...'
            });
            expect(events[1]).toMatchObject({
                type: 'tool_done',
                tool_call: {
                    function: {
                        name: 'task_complete'
                    }
                }
            });
            expect(events[2]).toMatchObject({
                type: 'response_output'
            });
        });

        it('should handle fatal errors correctly', async () => {
            const { ensembleRequest } = await import('@just-every/ensemble');
            
            // Mock error response
            (ensembleRequest as any).mockImplementationOnce(async function* () {
                yield {
                    type: 'tool_done',
                    tool_call: {
                        function: {
                            name: 'task_fatal_error'
                        }
                    },
                    result: {
                        output: 'Unable to complete task'
                    }
                };
            });
            
            const agent = new Agent({ name: 'TestAgent' });
            const events = [];
            for await (const event of runMECH(agent, 'Fail this task')) {
                events.push(event);
            }
            
            // Should have yielded the error event
            expect(events).toHaveLength(1);
            expect(events[0]).toMatchObject({
                type: 'tool_done',
                tool_call: {
                    function: {
                        name: 'task_fatal_error'
                    }
                }
            });
        });

        it('should handle exceptions', async () => {
            const { ensembleRequest } = await import('@just-every/ensemble');
            
            // Mock exception
            (ensembleRequest as any).mockImplementationOnce(async function* () {
                throw new Error('Network error');
            });
            
            const agent = new Agent({ name: 'TestAgent' });
            const events = [];
            for await (const event of runMECH(agent, 'Cause an error')) {
                events.push(event);
            }
            
            // Should have yielded an error event
            expect(events).toHaveLength(1);
            expect(events[0]).toMatchObject({
                type: 'error',
                error: expect.objectContaining({
                    message: expect.stringContaining('Network error')
                })
            });
        });
    });
});