import { describe, it, expect, beforeEach } from 'vitest';
import { runMECH, getTotalCost, resetCostTracker } from '../index.js';

describe('Simple MECH API', () => {
    beforeEach(() => {
        resetCostTracker();
    });

    it('should run a basic task', async () => {
        const result = await runMECH({
            agent: { name: 'TestAgent' },
            task: 'Say hello',
            runAgent: async (_agent, input, _history) => {
                return {
                    response: `Hello! You asked: ${input}`,
                    tool_calls: []
                };
            }
        });

        expect(result.status).toBe('complete');
        expect(result.mechOutcome).toBeDefined();
        expect(result.mechOutcome?.result).toBeDefined();
        expect(result.mechOutcome?.result).toContain('Hello!');
        expect(result.durationSec).toBeGreaterThanOrEqual(0);
    });

    it('should handle callbacks', async () => {
        const historyItems: any[] = [];
        const statusUpdates: any[] = [];

        await runMECH({
            agent: { name: 'CallbackAgent' },
            task: 'Test callbacks',
            runAgent: async (_agent, _input, _history) => ({
                response: 'Done',
                tool_calls: []
            }),
            onHistory: (item) => historyItems.push(item),
            onStatus: (status) => statusUpdates.push(status)
        });

        expect(historyItems.length).toBeGreaterThan(0);
        expect(statusUpdates.length).toBeGreaterThan(0);
    });

    it('should track costs', async () => {
        // Run a task
        await runMECH({
            agent: { name: 'CostAgent' },
            task: 'Track cost',
            runAgent: async (_agent, _input, _history) => ({
                response: 'Cost tracked',
                tool_calls: []
            })
        });

        const totalCost = getTotalCost();
        expect(totalCost).toBeGreaterThanOrEqual(0);
    });

    it('should handle errors gracefully', async () => {
        const result = await runMECH({
            agent: { name: 'ErrorAgent' },
            task: 'Cause error',
            runAgent: async (_agent, _input, _history) => {
                throw new Error('Test error');
            }
        });

        expect(result.status).toBe('fatal_error');
        expect(result.mechOutcome).toBeDefined();
        expect(result.mechOutcome?.error).toBeDefined(); 
        expect(result.mechOutcome?.error).toContain('Test error');
    });
});