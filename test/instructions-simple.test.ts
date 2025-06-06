import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runMECH } from '../index.js';
import * as ensemble from '@just-every/ensemble';
import { resetLLMRequestCount, mechState } from '../index.js';
import type { Agent } from '../types.js';

// Mock the ensemble module
vi.mock('@just-every/ensemble', async () => {
    const actual = await vi.importActual<typeof ensemble>('@just-every/ensemble');
    return {
        ...actual,
        ensembleRequest: vi.fn(),
        ensembleEmbed: vi.fn(() => Promise.resolve(new Array(1536).fill(0.1))),
        getModelFromClass: vi.fn((modelClass) => {
            const models = {
                coding: ['grok-beta', 'claude-3-5-sonnet-20241022', 'gpt-4o'],
                reasoning: ['o1-preview', 'o1-mini', 'claude-3-5-sonnet-20241022'],
                creative: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'gemini-1.5-pro'],
                speed: ['gpt-4o-mini', 'claude-3-5-haiku-20241022', 'gemini-1.5-flash'],
                standard: ['gpt-4o', 'claude-3-5-sonnet-20241022', 'gemini-1.5-pro']
            };
            const modelList = models[modelClass] || models.reasoning;
            return modelList[0];
        }),
        createToolFunction: vi.fn((fn, description, params, returns, name) => ({
            function: fn,
            definition: {
                type: 'function',
                function: {
                    name: name || fn.name,
                    description,
                    parameters: params
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

// Helper to create mock responses
function createMockResponse(content: string, toolCall?: { name: string; args: any }) {
    return async function* (messages: any, agent: any) {
        yield { type: 'message_delta', content } as any;
        
        if (toolCall) {
            const toolCallObj = {
                id: 'call_' + Date.now(),
                type: 'function' as const,
                function: {
                    name: toolCall.name,
                    arguments: JSON.stringify(toolCall.args)
                }
            };
            
            yield {
                type: 'tool_call',
                tool_calls: [toolCallObj]
            } as any;
            
            // Find and execute the tool
            const tool = agent.tools?.find((t: any) => 
                t.definition?.function?.name === toolCall.name
            );
            if (tool && agent.onToolResult) {
                const toolResult = await tool.function(toolCall.args);
                await agent.onToolResult({
                    toolCall: toolCallObj,
                    id: toolCallObj.id,
                    call_id: toolCallObj.id,
                    output: toolResult,
                    error: undefined
                });
            }
        }
    };
}

describe('Agent Instructions Simple Test', () => {
    let mockEnsembleRequest: ReturnType<typeof vi.fn>;
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    
    beforeEach(() => {
        mockEnsembleRequest = vi.mocked(ensemble.ensembleRequest);
        mockEnsembleRequest.mockClear();
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
        
        const agent: Agent = {
            name: 'HaikuAgent',
            instructions: testInstructions,
            modelClass: 'reasoning'
        };

        // Mock the ensembleRequest to return a completion
        mockEnsembleRequest.mockImplementation(createMockResponse(
            'Task done in haiku',
            { name: 'task_complete', args: { result: 'Haiku task complete' } }
        ));

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
        expect(result.mechOutcome?.result).toBe('Task completed: Haiku task complete');
    });

    it('should work without instructions', async () => {
        const agent: Agent = {
            name: 'BasicAgent',
            modelClass: 'reasoning'
        };

        mockEnsembleRequest.mockImplementation(createMockResponse(
            'Task done',
            { name: 'task_complete', args: { result: 'Done' } }
        ));

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