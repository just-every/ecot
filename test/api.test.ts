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

// Mock model rotation
vi.mock('../src/core/model_rotation.js', () => ({
    rotateModel: vi.fn().mockResolvedValue('gpt-4')
}));

describe('MECH API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('runMECH', () => {
        it('should validate agent parameter', async () => {
            await expect(runMECH(null as any, 'test')).rejects.toThrow('Agent must be a valid Agent instance');
            await expect(runMECH('not an agent' as any, 'test')).rejects.toThrow('Agent must be a valid Agent instance');
        });

        it('should validate content parameter', async () => {
            const agent = new Agent({ name: 'TestAgent' });
            await expect(runMECH(agent, null as any)).rejects.toThrow('Content must be a non-empty string');
            await expect(runMECH(agent, '')).rejects.toThrow('Content must be a non-empty string');
            await expect(runMECH(agent, '   ')).rejects.toThrow('Content must be a non-empty string');
        });

        it('should successfully run a simple task', async () => {
            const agent = new Agent({ 
                name: 'TestAgent',
                instructions: 'You are a test agent'
            });
            
            const result = await runMECH(agent, 'Complete this test task');
            
            expect(result).toMatchObject({
                status: 'complete',
                durationSec: expect.any(Number),
                totalCost: 0.01,
                history: expect.any(Array),
                mechOutcome: {
                    status: 'complete',
                    result: 'Task completed successfully'
                }
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
            const result = await runMECH(agent, 'Fail this task');
            
            expect(result).toMatchObject({
                status: 'fatal_error',
                mechOutcome: {
                    status: 'fatal_error',
                    error: 'Unable to complete task'
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
            const result = await runMECH(agent, 'Cause an error');
            
            expect(result).toMatchObject({
                status: 'fatal_error',
                mechOutcome: {
                    status: 'fatal_error',
                    error: expect.stringContaining('Network error')
                }
            });
        });
    });
});