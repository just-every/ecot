import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runTask, addMessageToTask } from '../src/core/engine.js';
import { Agent } from '@just-every/ensemble';

// Mock ensemble
vi.mock('@just-every/ensemble', async (importOriginal) => {
    const original = await importOriginal() as any;
    return {
        ...original,
        ensembleRequest: vi.fn()
            .mockImplementationOnce(async function* (messages: any) {
                // First call - no injected message yet
                yield {
                    type: 'response_output',
                    message: {
                        type: 'message',
                        role: 'assistant',
                        content: 'Let me analyze this...'
                    }
                };
            })
            .mockImplementationOnce(async function* (messages: any) {
                // Second call - should see the injected message
                const lastMessage = messages[messages.length - 1];
                if (lastMessage?.role === 'developer') {
                    // Acknowledge the injected message
                    yield {
                        type: 'response_output',
                        message: {
                            type: 'message',
                            role: 'assistant',
                            content: `I see the developer message: ${lastMessage.content}`
                        }
                    };
                }
                
                // Complete the task
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
            }),
        Agent: vi.fn().mockImplementation(function(config: any) {
            return { ...config, name: config.name || 'TestAgent' };
        }),
        cloneAgent: vi.fn().mockImplementation((agent: any) => ({ ...agent })),
        createToolFunction: original.createToolFunction,
        waitWhilePaused: vi.fn().mockResolvedValue(undefined)
    };
});

describe('Message Injection', () => {
    let consoleLogSpy: any;
    let agent: Agent;

    beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        agent = new Agent({ name: 'TestAgent' });
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        vi.clearAllMocks();
    });

    it('should inject messages during task execution', async () => {
        const task = runTask(agent, 'Analyze this code');
        const events: any[] = [];
        
        // Start consuming events
        const consumeTask = (async () => {
            for await (const event of task) {
                events.push(event);
                
                // After first response, inject a message
                if (events.length === 1 && event.type === 'response_output') {
                    addMessageToTask(task, {
                        type: 'message',
                        role: 'developer',
                        content: 'Focus on security issues'
                    });
                }
            }
        })();
        
        await consumeTask;
        
        // Verify the injection was logged
        expect(consoleLogSpy).toHaveBeenCalledWith('[Task] External message added with role: developer');
        
        // Verify we got the expected events
        expect(events.length).toBeGreaterThan(0);
        
        // Check if task completed
        const completionEvent = events.find(e => e.type === 'task_complete');
        expect(completionEvent).toBeDefined();
    });

    it('should use consistent validation for both external and metacognition messages', async () => {
        const { internalAddMessage } = await import('../src/core/engine.js');
        const messages: any[] = [];
        
        // Test valid message
        internalAddMessage(messages, {
            type: 'message',
            role: 'developer',
            content: 'Test message'
        }, 'external');
        
        expect(messages.length).toBe(1);
        expect(consoleLogSpy).toHaveBeenCalledWith('[Task] External message added with role: developer');
        
        // Test metacognition source
        internalAddMessage(messages, {
            type: 'message',
            role: 'developer',
            content: 'Metacognition message'
        }, 'metacognition');
        
        expect(messages.length).toBe(2);
        expect(consoleLogSpy).toHaveBeenCalledWith('[Task] Metacognition message added with role: developer');
        
        // Test validation errors
        expect(() => internalAddMessage(messages, null as any)).toThrow('Message must be a valid message object');
        expect(() => internalAddMessage(messages, { type: 'invalid' } as any)).toThrow('Message must have type "message"');
        expect(() => internalAddMessage(messages, { type: 'message', role: 'invalid' } as any)).toThrow('Message must have a valid role');
        expect(() => internalAddMessage(messages, { type: 'message', role: 'user' } as any)).toThrow('Message must have string content');
    });

    it('should maintain message order when injecting', async () => {
        const { ensembleRequest } = await import('@just-every/ensemble');
        let capturedMessages: any[] = [];
        
        // Mock to capture messages
        (ensembleRequest as any).mockImplementation(async function* (messages: any) {
            capturedMessages = [...messages];
            yield {
                type: 'tool_done',
                tool_call: { function: { name: 'task_complete' } },
                result: { output: 'Done' }
            };
        });
        
        const task = runTask(agent, 'Initial task');
        
        // Inject multiple messages
        addMessageToTask(task, {
            type: 'message',
            role: 'developer',
            content: 'First injection'
        });
        
        addMessageToTask(task, {
            type: 'message',
            role: 'user',
            content: 'Second injection'
        });
        
        // Consume the task
        for await (const event of task) {
            // Just consume events
        }
        
        // Verify message order
        expect(capturedMessages.length).toBeGreaterThanOrEqual(3);
        expect(capturedMessages[0].content).toBe('Initial task');
        expect(capturedMessages[capturedMessages.length - 2].content).toBe('First injection');
        expect(capturedMessages[capturedMessages.length - 1].content).toBe('Second injection');
    });
});