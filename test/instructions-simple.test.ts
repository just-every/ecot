import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runMECH } from '../index.js';
import { request, ToolCallAction } from '@just-every/ensemble';
import { resetLLMRequestCount, mechState } from '../index.js';
import type { MechAgent } from '../types.js';

// Mock the ensemble request function
vi.mock('@just-every/ensemble', async () => {
    const actual = await vi.importActual('@just-every/ensemble');
    return {
        ...actual,
        request: vi.fn(),
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
    };
});

describe('Agent Instructions Simple Test', () => {
    let mockedRequest: ReturnType<typeof vi.fn>;
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    
    beforeEach(() => {
        mockedRequest = request as ReturnType<typeof vi.fn>;
        mockedRequest.mockClear();
        resetLLMRequestCount();
        mechState.disabledModels.clear();
        mechState.modelScores = {};
        
        // Spy on console.log to capture the system message log
        consoleLogSpy = vi.spyOn(console, 'log');
    });
    
    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    it('should include agent instructions in system message', async () => {
        const testInstructions = 'You are a helpful assistant who always responds in haiku format.';
        
        const agent: MechAgent = {
            name: 'HaikuAgent',
            instructions: testInstructions,
            modelClass: 'reasoning'
        };

        // Mock the request to return a completion
        mockedRequest.mockImplementation((model, messages, options) => {
            return (async function* () {
                yield { type: 'message_delta', content: 'Task done in haiku' };
                
                const toolCall = {
                    id: 'test-1',
                    type: 'function' as const,
                    function: {
                        name: 'task_complete',
                        arguments: JSON.stringify({ result: 'Haiku task complete' })
                    }
                };
                
                if (options?.toolHandler?.onToolCall) {
                    const action = await options.toolHandler.onToolCall(toolCall, options.toolHandler.context);
                    if (action === ToolCallAction.EXECUTE && options?.toolHandler?.onToolComplete) {
                        await options.toolHandler.onToolComplete(toolCall, 'Haiku task complete', options.toolHandler.context);
                    }
                }
            })();
        });

        const result = await runMECH({
            agent,
            task: 'Write a haiku about coding'
        });

        // Check that the system message was logged with both instructions
        const systemMessageLog = consoleLogSpy.mock.calls.find(
            call => call[0] === '[MECH] System message:' && call[1]
        );
        
        expect(systemMessageLog).toBeDefined();
        const systemContent = systemMessageLog?.[1];
        expect(systemContent).toContain(testInstructions);
        expect(systemContent).toContain('You must complete tasks by using the provided tools');
        
        // Verify order: custom instructions first, then tool guidance
        const instructionsIndex = systemContent.indexOf(testInstructions);
        const toolGuidanceIndex = systemContent.indexOf('You must complete tasks');
        expect(instructionsIndex).toBeLessThan(toolGuidanceIndex);
        
        expect(result.status).toBe('complete');
        expect(result.mechOutcome?.result).toBe('Haiku task complete');
    });

    it('should work without instructions', async () => {
        const agent: MechAgent = {
            name: 'BasicAgent',
            modelClass: 'reasoning'
        };

        mockedRequest.mockImplementation((model, messages, options) => {
            return (async function* () {
                yield { type: 'message_delta', content: 'Task done' };
                
                const toolCall = {
                    id: 'test-2',
                    type: 'function' as const,
                    function: {
                        name: 'task_complete',
                        arguments: JSON.stringify({ result: 'Done' })
                    }
                };
                
                if (options?.toolHandler?.onToolCall) {
                    const action = await options.toolHandler.onToolCall(toolCall, options.toolHandler.context);
                    if (action === ToolCallAction.EXECUTE && options?.toolHandler?.onToolComplete) {
                        await options.toolHandler.onToolComplete(toolCall, 'Done', options.toolHandler.context);
                    }
                }
            })();
        });

        await runMECH({
            agent,
            task: 'Do something'
        });

        // Check that only tool guidance is in the system message
        const systemMessageLog = consoleLogSpy.mock.calls.find(
            call => call[0] === '[MECH] System message:' && call[1]
        );
        
        expect(systemMessageLog).toBeDefined();
        const systemContent = systemMessageLog?.[1];
        expect(systemContent).toBe('You must complete tasks by using the provided tools. When you have finished a task, you MUST call the task_complete tool with a comprehensive result. If you cannot complete the task, you MUST call the task_fatal_error tool with an explanation. Do not just provide a final answer without using these tools.');
    });
});