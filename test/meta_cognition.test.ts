import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawnMetaThought } from '../src/core/meta_cognition.js';
import { taskState, setMetaFrequency, setModelScore, disableModel } from '../src/state/state.js';
import type { ResponseInput } from '@just-every/ensemble';

// Mock ensemble imports
vi.mock('@just-every/ensemble', () => ({
    ResponseInput: Array,
    MODEL_CLASSES: {
        reasoning: {
            models: ['gpt-4-turbo', 'claude-3', 'gemini-pro']
        },
        standard: {
            models: ['gpt-3.5-turbo', 'claude-instant']
        }
    },
    findModel: vi.fn().mockReturnValue({ id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }),
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
    Agent: vi.fn().mockImplementation((definition) => ({
        ...definition,
        agent_id: definition.agent_id || 'test-agent',
        name: definition.name || 'TestAgent',
        export: () => definition,
        getTools: async () => definition.tools || [],
        asTool: () => ({})
    })),
    ensembleRequest: vi.fn().mockImplementation(async function* () {
        yield {
            type: 'message_delta',
            content: 'Analyzing performance...'
        };
        yield {
            type: 'tool_done',
            tool_call: {
                function: {
                    name: 'no_changes_needed'
                }
            },
            result: {
                output: 'No changes needed'
            }
        };
    })
}));

describe('Meta-cognition', () => {
    let mockAgent: any;
    let mockMessages: ResponseInput;
    let consoleLogSpy: any;
    let consoleErrorSpy: any;

    beforeEach(() => {
        // Reset state
        taskState.metaFrequency = '5';
        taskState.llmRequestCount = 0;
        taskState.disabledModels.clear();
        Object.keys(taskState.modelScores).forEach(key => {
            delete taskState.modelScores[key];
        });
        
        // Clear all mocks
        vi.clearAllMocks();

        // Spy on console
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // Create mock agent
        mockAgent = {
            name: 'TestAgent',
            agent_id: 'test-agent-001'
        };

        // Create mock messages
        mockMessages = [
            {
                type: 'message',
                role: 'system',
                content: 'You are a helpful assistant.'
            },
            {
                type: 'message',
                role: 'user',
                content: 'Test task'
            },
            {
                type: 'message',
                role: 'assistant',
                content: 'Processing...'
            }
        ];
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    describe('Basic functionality', () => {
        it('should spawn metacognition process successfully', async () => {
            const startTime = new Date();
            
            await spawnMetaThought(mockAgent, mockMessages, startTime);
            
            expect(consoleLogSpy).toHaveBeenCalledWith('[Task] Spawning metacognition process');
            expect(consoleLogSpy).toHaveBeenCalledWith('[Task] Metacognition process completed');
        });

        it('should create a metacognition agent', async () => {
            const { Agent } = await import('@just-every/ensemble');
            const startTime = new Date();
            
            await spawnMetaThought(mockAgent, mockMessages, startTime);
            
            expect(Agent).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'MetacognitionAgent',
                    agent_id: 'test-agent-001',
                    instructions: expect.stringContaining('metacognition')
                })
            );
        });

        it('should include system state in instructions', async () => {
            const { Agent } = await import('@just-every/ensemble');
            const startTime = new Date();
            
            // Set up some state AFTER the mock is cleared
            taskState.llmRequestCount = 25;
            taskState.metaFrequency = '10';
            taskState.modelScores['gpt-4'] = 85;
            taskState.disabledModels.add('claude-3');
            
            await spawnMetaThought(mockAgent, mockMessages, startTime);
            
            const agentCall = (Agent as any).mock.calls[0][0];
            expect(agentCall.instructions).toContain('LLM Requests: 25');
            expect(agentCall.instructions).toContain('Meta Frequency: Every 10 requests');
            expect(agentCall.instructions).toContain('gpt-4: 85');
            expect(agentCall.instructions).toContain('claude-3');
        });
    });

    describe('Error handling', () => {
        it('should validate agent parameter', async () => {
            const startTime = new Date();
            
            await expect(spawnMetaThought(null as any, mockMessages, startTime))
                .rejects.toThrow('Invalid agent');
            
            await expect(spawnMetaThought(undefined as any, mockMessages, startTime))
                .rejects.toThrow('Invalid agent');
        });

        it('should validate messages parameter', async () => {
            const startTime = new Date();
            
            await expect(spawnMetaThought(mockAgent, null as any, startTime))
                .rejects.toThrow('Invalid messages');
            
            await expect(spawnMetaThought(mockAgent, 'not an array' as any, startTime))
                .rejects.toThrow('Invalid messages');
        });

        it('should validate startTime parameter', async () => {
            await expect(spawnMetaThought(mockAgent, mockMessages, null as any))
                .rejects.toThrow('Invalid startTime');
            
            await expect(spawnMetaThought(mockAgent, mockMessages, 'not a date' as any))
                .rejects.toThrow('Invalid startTime');
        });


        it('should catch and log ensemble request errors', async () => {
            const { ensembleRequest } = await import('@just-every/ensemble');
            (ensembleRequest as any).mockImplementationOnce(async function* () {
                throw new Error('Network error');
            });
            
            const startTime = new Date();
            
            await expect(spawnMetaThought(mockAgent, mockMessages, startTime))
                .rejects.toThrow('Network error');
            
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[Task] Error in metacognition:', 
                expect.any(Error)
            );
        });
    });

    describe('Tool integration', () => {
        it('should include metacognition tools', async () => {
            const { Agent } = await import('@just-every/ensemble');
            const startTime = new Date();
            
            await spawnMetaThought(mockAgent, mockMessages, startTime);
            
            const agentCall = (Agent as any).mock.calls[0][0];
            const toolNames = agentCall.tools.map((t: any) => t.definition.function.name);
            
            expect(toolNames).toContain('injectThought');
            expect(toolNames).toContain('setMetaFrequency');
            expect(toolNames).toContain('setModelScore');
            expect(toolNames).toContain('disableModel');
            expect(toolNames).toContain('noChangesNeeded');
        });

        it('should include thought management tools', async () => {
            const { Agent } = await import('@just-every/ensemble');
            const startTime = new Date();
            
            await spawnMetaThought(mockAgent, mockMessages, startTime);
            
            const agentCall = (Agent as any).mock.calls[0][0];
            const toolNames = agentCall.tools.map((t: any) => t.definition.function.name);
            
            expect(toolNames).toContain('set_thought_delay');
            expect(toolNames).toContain('interrupt_delay');
            expect(toolNames).toContain('get_thought_delay');
        });
    });

    describe('Message history', () => {
        it('should include recent history in user message', async () => {
            const { ensembleRequest } = await import('@just-every/ensemble');
            const startTime = new Date();
            
            // Add more messages
            mockMessages.push(
                { type: 'message', role: 'user', content: 'Another request' },
                { type: 'message', role: 'assistant', content: 'Another response' }
            );
            
            await spawnMetaThought(mockAgent, mockMessages, startTime);
            
            const requestCall = (ensembleRequest as any).mock.calls[0];
            const metaMessages = requestCall[0];
            const userMessage = metaMessages.find((m: any) => m.role === 'user');
            
            expect(userMessage.content).toContain('Recent history:');
            expect(userMessage.content).toContain('user: Test task');
            expect(userMessage.content).toContain('assistant: Processing...');
        });

        it('should handle message injection', async () => {
            const { ensembleRequest } = await import('@just-every/ensemble');
            
            // Mock a tool call that injects a thought
            (ensembleRequest as any).mockImplementationOnce(async function* () {
                yield {
                    type: 'tool_done',
                    tool_call: {
                        function: {
                            name: 'injectThought'
                        }
                    },
                    result: {
                        output: 'Thought injected'
                    }
                };
            });
            
            const startTime = new Date();
            await spawnMetaThought(mockAgent, mockMessages, startTime);
            
            // The injectThought function should have added a message
            const lastMessage = mockMessages[mockMessages.length - 1];
            expect(lastMessage).toBeDefined();
        });
    });

    describe('Timing calculations', () => {
        it('should calculate running time correctly', async () => {
            const { Agent } = await import('@just-every/ensemble');
            const startTime = new Date(Date.now() - 30000); // 30 seconds ago
            
            await spawnMetaThought(mockAgent, mockMessages, startTime);
            
            const agentCall = (Agent as any).mock.calls[0][0];
            expect(agentCall.instructions).toContain('Runtime: 30 seconds');
        });
    });
});