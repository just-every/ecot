import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runMECH, getTotalCost, resetCostTracker } from '../index.js';
import { request } from '@just-every/ensemble';

// Mock the ensemble request function
vi.mock('@just-every/ensemble', () => ({
    request: vi.fn(),
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
    embed: vi.fn(async (text) => Array(1536).fill(0).map(() => Math.random()))
}));

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

describe('Simple MECH API', () => {
    let mockedRequest: ReturnType<typeof vi.fn>;
    
    beforeEach(() => {
        resetCostTracker();
        
        // Setup mock for ensemble.request()
        mockedRequest = request as ReturnType<typeof vi.fn>;
        mockedRequest.mockClear();
    });

    it('should run a basic task', async () => {
        mockedRequest.mockImplementation(() => {
            return createMockStream(
                'Hello! I will complete this task.',
                [{ 
                    name: 'task_complete', 
                    arguments: { result: 'Hello! Task completed successfully' } 
                }]
            );
        });

        const result = await runMECH({
            agent: { name: 'TestAgent' },
            task: 'Say hello',
            loop: false
        });

        expect(result.status).toBe('complete');
        expect(result.mechOutcome).toBeDefined();
        expect(result.mechOutcome?.result).toBeDefined();
        expect(result.mechOutcome?.result).toBe('Hello! Task completed successfully');
        expect(result.durationSec).toBeGreaterThanOrEqual(0);
        expect(mockedRequest).toHaveBeenCalledTimes(1);
    });

    it('should handle callbacks', async () => {
        mockedRequest.mockImplementation(() => {
            return createMockStream(
                'Callback test completed',
                [{ 
                    name: 'task_complete', 
                    arguments: { result: 'Callbacks working' } 
                }]
            );
        });

        const historyItems: any[] = [];
        const statusUpdates: any[] = [];

        await runMECH({
            agent: { name: 'CallbackAgent' },
            task: 'Test callbacks',
            loop: false,
            onHistory: (item) => historyItems.push(item),
            onStatus: (status) => statusUpdates.push(status)
        });

        expect(historyItems.length).toBeGreaterThan(0);
        expect(statusUpdates.length).toBeGreaterThan(0);
    });

    it('should track costs', async () => {
        mockedRequest.mockImplementation(() => {
            return createMockStream(
                'Cost tracking completed',
                [{ 
                    name: 'task_complete', 
                    arguments: { result: 'Cost tracked successfully' } 
                }]
            );
        });

        // Run a task
        await runMECH({
            agent: { name: 'CostAgent' },
            task: 'Track cost',
            loop: false
        });

        const totalCost = getTotalCost();
        expect(totalCost).toBeGreaterThanOrEqual(0);
    });

    it('should handle errors gracefully', async () => {
        mockedRequest.mockImplementation(() => {
            throw new Error('Test error');
        });

        const result = await runMECH({
            agent: { name: 'ErrorAgent' },
            task: 'Cause error',
            loop: false
        });

        expect(result.status).toBe('fatal_error');
        expect(result.mechOutcome).toBeDefined();
        expect(result.mechOutcome?.error).toBeDefined(); 
        expect(result.mechOutcome?.error).toContain('Test error');
    });
});