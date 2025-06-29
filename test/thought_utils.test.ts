import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    setThoughtDelay,
    getThoughtDelay,
    setDelayInterrupted,
    isDelayInterrupted,
    runThoughtDelay,
    getDelayAbortSignal,
    getThoughtTools
} from '../src/core/thought_utils.js';

describe('Thought Utils', () => {
    beforeEach(() => {
        // Reset state
        setThoughtDelay('0');
        setDelayInterrupted(false);
    });

    describe('Thought delay management', () => {
        it('should set and get thought delay', () => {
            expect(getThoughtDelay()).toBe('0');
            
            setThoughtDelay('2');
            expect(getThoughtDelay()).toBe('2');
            
            setThoughtDelay('8');
            expect(getThoughtDelay()).toBe('8');
            
            setThoughtDelay('32');
            expect(getThoughtDelay()).toBe('32');
        });

        it('should validate delay values', () => {
            expect(() => setThoughtDelay('invalid' as any)).toThrow(/Thought delay must be one of/);
            expect(getThoughtDelay()).toBe('0'); // Should remain at previous value
        });

        it('should only accept valid delays', () => {
            const validDelays = ['0', '2', '4', '8', '16', '32', '64', '128'];
            validDelays.forEach(delay => {
                setThoughtDelay(delay as any);
                expect(getThoughtDelay()).toBe(delay);
            });
        });
    });

    describe('Delay interruption', () => {
        it('should set and check interruption state', () => {
            expect(isDelayInterrupted()).toBe(false);
            
            setDelayInterrupted(true);
            expect(isDelayInterrupted()).toBe(true);
            
            setDelayInterrupted(false);
            expect(isDelayInterrupted()).toBe(false);
        });

        it('should get abort signal', () => {
            const signal = getDelayAbortSignal();
            expect(signal).toBeInstanceOf(AbortSignal);
            expect(signal.aborted).toBe(false);
            
            setDelayInterrupted(true);
            const signal2 = getDelayAbortSignal();
            expect(signal2.aborted).toBe(true);
        });
    });

    describe('runThoughtDelay', () => {
        it('should complete immediately with 0 delay', async () => {
            setThoughtDelay('0');
            const start = Date.now();
            
            await runThoughtDelay();
            
            const elapsed = Date.now() - start;
            expect(elapsed).toBeLessThan(50); // Should be nearly instant
        });

        it('should wait for specified delay', async () => {
            setThoughtDelay('2');
            const start = Date.now();
            
            await runThoughtDelay();
            
            const elapsed = Date.now() - start;
            expect(elapsed).toBeGreaterThanOrEqual(1995); // Allow 5ms tolerance
            expect(elapsed).toBeLessThan(2100); // Some tolerance
        });

        it('should handle interruption', async () => {
            setThoughtDelay('8'); // 8 seconds
            const start = Date.now();
            
            // Start the delay in background
            const delayPromise = runThoughtDelay().catch(() => {});
            
            // Wait a bit then interrupt
            await new Promise(resolve => setTimeout(resolve, 100));
            setDelayInterrupted(true);
            
            await delayPromise;
            
            const elapsed = Date.now() - start;
            expect(elapsed).toBeLessThan(1000); // Should exit early
        });

        it('should log delay message', async () => {
            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            
            setThoughtDelay('2');
            await runThoughtDelay();
            
            expect(consoleLogSpy).toHaveBeenCalledWith('[Task] Thought delay: 2 seconds');
            
            consoleLogSpy.mockRestore();
        });
    });

    describe('getThoughtTools', () => {
        it('should return thought management tools', () => {
            const tools = getThoughtTools();
            
            expect(tools).toHaveLength(3);
            
            // Check tool names
            const toolNames = tools.map(t => t.definition.function.name);
            expect(toolNames).toContain('set_thought_delay');
            expect(toolNames).toContain('interrupt_delay');
            expect(toolNames).toContain('get_thought_delay');
            
            // Test set_thought_delay
            const setDelayTool = tools.find(t => t.definition.function.name === 'set_thought_delay');
            const result = setDelayTool!.function('4');
            expect(result).toBe('Thought delay set to 4 seconds');
            expect(getThoughtDelay()).toBe('4');
        });

        it('should provide interrupt delay tool', () => {
            const tools = getThoughtTools();
            const interruptTool = tools.find(t => t.definition.function.name === 'interrupt_delay');
            
            const result = interruptTool!.function();
            expect(result).toBe('Thought delay interrupted');
            expect(isDelayInterrupted()).toBe(true);
            
            // Reset
            setDelayInterrupted(false);
        });

        it('should provide get delay tool', () => {
            setThoughtDelay('16');
            const tools = getThoughtTools();
            const getTool = tools.find(t => t.definition.function.name === 'get_thought_delay');
            
            const result = getTool!.function();
            expect(result).toBe('Current thought delay: 16 seconds');
        });
    });

    describe('Edge cases', () => {
        it('should handle rapid interruptions', async () => {
            setThoughtDelay('4');
            
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(runThoughtDelay().catch(() => {}));
                setDelayInterrupted(true);
                setDelayInterrupted(false);
            }
            
            await Promise.all(promises);
            expect(isDelayInterrupted()).toBe(false);
        });

        it('should handle concurrent delays', async () => {
            setThoughtDelay('2');
            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            
            // Start multiple delays
            const delay1 = runThoughtDelay();
            const delay2 = runThoughtDelay();
            
            // Interrupt after 500ms
            setTimeout(() => setDelayInterrupted(true), 500);
            
            await Promise.all([delay1, delay2].map(p => p.catch(() => {})));
            
            // Should have logged the delay message
            expect(consoleLogSpy).toHaveBeenCalledWith('[Task] Thought delay: 2 seconds');
            
            consoleLogSpy.mockRestore();
        });
    });
});