/**
 * Performance Tests for MECH System
 * 
 * Tests performance characteristics, caching efficiency,
 * and resource utilization of the MECH system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
    rotateModel,
    setModelScore,
    getModelScore,
    setThoughtDelay,
    runThoughtDelay,
    mechState,
    resetLLMRequestCount,
    MechPerformanceCache,
    globalPerformanceCache,
    OptimizedThoughtDelay,
    type MechAgent,
    type MechContext
} from '../index.js';

describe('MECH Performance Tests', () => {
    let mockAgent: MechAgent;
    let mockContext: MechContext;

    beforeEach(() => {
        // Reset state
        resetLLMRequestCount();
        mechState.disabledModels.clear();
        mechState.modelScores = {};
        
        // Clear performance cache
        globalPerformanceCache.clear();

        // Create mock agent
        mockAgent = {
            name: 'PerformanceTestAgent',
            agent_id: 'perf-test-' + Date.now(),
            created_at: new Date(),
            tools: []
        };

        // Create minimal mock context
        mockContext = {
            sendComms: vi.fn(),
            getCommunicationManager: vi.fn(),
            addHistory: vi.fn(),
            getHistory: vi.fn().mockReturnValue([]),
            costTracker: { getTotalCost: vi.fn().mockReturnValue(0) },
            createToolFunction: vi.fn()
        } as any;
    });

    describe('Model Rotation Performance', () => {
        it('should handle rapid model rotation efficiently', async () => {
            // Set up multiple models with scores
            for (let i = 1; i <= 10; i++) {
                setModelScore(`test-model-${i}`, String(i * 10));
            }

            const startTime = Date.now();
            const rotations = [];

            // Perform many rotations
            for (let i = 0; i < 100; i++) {
                const model = await rotateModel(mockAgent);
                rotations.push(model);
            }

            const duration = Date.now() - startTime;

            expect(rotations.length).toBe(100);
            expect(duration).toBeLessThan(1000); // Should complete in under 1 second
            console.log(`100 model rotations completed in ${duration}ms`);
        });

        it('should demonstrate caching efficiency for score calculations', () => {
            const cache = new MechPerformanceCache(10000, 5000); // 10s TTL
            let computeCallCount = 0;

            const expensiveComputation = () => {
                computeCallCount++;
                // Simulate expensive calculation
                let result = 0;
                for (let i = 0; i < 1000; i++) {
                    result += Math.sqrt(i);
                }
                return 75; // Return a score
            };

            const startTime = Date.now();

            // First call - should compute
            const score1 = cache.getCachedScore('test-model', 'reasoning', expensiveComputation);
            expect(score1).toBe(75);
            expect(computeCallCount).toBe(1);

            // Second call - should use cache
            const score2 = cache.getCachedScore('test-model', 'reasoning', expensiveComputation);
            expect(score2).toBe(75);
            expect(computeCallCount).toBe(1); // No additional computation

            // Many more calls - all cached
            for (let i = 0; i < 50; i++) {
                cache.getCachedScore('test-model', 'reasoning', expensiveComputation);
            }

            const duration = Date.now() - startTime;
            expect(computeCallCount).toBe(1); // Still only one computation
            expect(duration).toBeLessThan(100); // Should be very fast due to caching

            console.log(`50 cached score retrievals completed in ${duration}ms with ${computeCallCount} computation(s)`);
        });

        it('should handle cache invalidation correctly', () => {
            const cache = new MechPerformanceCache(10000, 5000);
            let computeCallCount = 0;

            const computation = () => {
                computeCallCount++;
                return Math.floor(Math.random() * 100);
            };

            // Initial computation
            const score1 = cache.getCachedScore('test-model', 'reasoning', computation);
            expect(computeCallCount).toBe(1);

            // Cached retrieval
            const score2 = cache.getCachedScore('test-model', 'reasoning', computation);
            expect(score2).toBe(score1);
            expect(computeCallCount).toBe(1);

            // Invalidate cache
            cache.invalidateModel('test-model');

            // Should recompute
            const score3 = cache.getCachedScore('test-model', 'reasoning', computation);
            expect(computeCallCount).toBe(2);
        });
    });

    describe('Thought Delay Performance', () => {
        it('should handle optimized delays efficiently', async () => {
            const startTime = Date.now();
            
            // Test multiple small delays
            await OptimizedThoughtDelay.runDelay(100); // 100ms
            await OptimizedThoughtDelay.runDelay(50);  // 50ms
            await OptimizedThoughtDelay.runDelay(25);  // 25ms

            const duration = Date.now() - startTime;
            
            // Should be close to 175ms (100+50+25) with minimal overhead
            expect(duration).toBeGreaterThan(150);
            expect(duration).toBeLessThan(250);
            
            console.log(`Optimized delays completed in ${duration}ms (expected ~175ms)`);
        });

        it('should handle delay interruption efficiently', async () => {
            const controller = new AbortController();
            
            // Start a long delay
            const delayPromise = OptimizedThoughtDelay.runDelay(5000, controller.signal);
            
            const startTime = Date.now();
            
            // Interrupt after 100ms
            setTimeout(() => {
                controller.abort();
            }, 100);

            try {
                await delayPromise;
            } catch (error) {
                // Expected to be aborted
            }

            const duration = Date.now() - startTime;
            
            // Should complete quickly due to interruption
            expect(duration).toBeLessThan(200);
            expect(controller.signal.aborted).toBe(true);
            
            console.log(`Delay interruption handled in ${duration}ms`);
        });

        it('should demonstrate delay batching efficiency', async () => {
            setThoughtDelay('2'); // 2 second delay
            
            const startTime = Date.now();
            
            // Run multiple delays
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(runThoughtDelay(mockContext));
            }
            
            await Promise.all(promises);
            
            const duration = Date.now() - startTime;
            
            // All delays should run concurrently, not sequentially
            expect(duration).toBeLessThan(2500); // Should complete close to 2 seconds, not 10 (5x2)
            
            console.log(`5 concurrent delays completed in ${duration}ms`);
        });
    });

    describe('Memory and State Performance', () => {
        it('should handle rapid state updates efficiently', () => {
            const startTime = Date.now();
            
            // Perform many state updates
            for (let i = 0; i < 1000; i++) {
                setModelScore(`model-${i % 10}`, String((i % 100) + 1));
                mechState.llmRequestCount = i;
            }
            
            const duration = Date.now() - startTime;
            
            expect(duration).toBeLessThan(100); // Should be very fast
            expect(Object.keys(mechState.modelScores).length).toBe(10);
            expect(mechState.llmRequestCount).toBe(999);
            
            console.log(`1000 state updates completed in ${duration}ms`);
        });

        it('should demonstrate efficient model score retrieval', () => {
            // Set up many model scores
            for (let i = 1; i <= 100; i++) {
                setModelScore(`model-${i}`, String(i));
            }
            
            const startTime = Date.now();
            
            // Retrieve scores many times
            const scores = [];
            for (let i = 0; i < 1000; i++) {
                const modelId = `model-${(i % 100) + 1}`;
                scores.push(getModelScore(modelId));
            }
            
            const duration = Date.now() - startTime;
            
            expect(scores.length).toBe(1000);
            expect(duration).toBeLessThan(50); // Should be very fast
            
            console.log(`1000 score retrievals completed in ${duration}ms`);
        });
    });

    describe('Cache Performance Characteristics', () => {
        it('should demonstrate cache hit ratio improvements', () => {
            const cache = new MechPerformanceCache(5000, 2000);
            let computations = 0;
            
            const expensiveOp = () => {
                computations++;
                return Math.random() * 100;
            };
            
            const models = ['model-1', 'model-2', 'model-3'];
            const classes = ['reasoning', 'coding', 'general'];
            
            // Generate cache entries
            for (const model of models) {
                for (const cls of classes) {
                    cache.getCachedScore(model, cls as any, expensiveOp);
                }
            }
            
            expect(computations).toBe(9); // 3 models × 3 classes
            
            // Now test cache hits
            const startTime = Date.now();
            let cacheHits = 0;
            
            for (let i = 0; i < 100; i++) {
                const model = models[i % models.length];
                const cls = classes[i % classes.length];
                cache.getCachedScore(model, cls as any, expensiveOp);
                
                if (computations === 9) { // No new computations = cache hit
                    cacheHits++;
                }
            }
            
            const duration = Date.now() - startTime;
            
            expect(computations).toBe(9); // No additional computations
            expect(duration).toBeLessThan(50); // Very fast due to caching
            
            console.log(`100 cache operations completed in ${duration}ms with 100% hit ratio`);
        });

        it('should handle cache expiry correctly', async () => {
            const shortTTL = 100; // 100ms TTL
            const cache = new MechPerformanceCache(shortTTL, shortTTL);
            let computations = 0;
            
            const computation = () => {
                computations++;
                return 50;
            };
            
            // First computation
            cache.getCachedScore('test-model', 'reasoning', computation);
            expect(computations).toBe(1);
            
            // Immediate cache hit
            cache.getCachedScore('test-model', 'reasoning', computation);
            expect(computations).toBe(1);
            
            // Wait for expiry
            await new Promise(resolve => setTimeout(resolve, 150));
            
            // Should recompute after expiry
            cache.getCachedScore('test-model', 'reasoning', computation);
            expect(computations).toBe(2);
        });
    });

    describe('Concurrent Operation Performance', () => {
        it('should handle concurrent model rotations safely', async () => {
            // Set up models
            for (let i = 1; i <= 5; i++) {
                setModelScore(`concurrent-model-${i}`, String(i * 20));
            }
            
            const startTime = Date.now();
            
            // Run many concurrent rotations
            const promises = [];
            for (let i = 0; i < 50; i++) {
                promises.push(rotateModel({ ...mockAgent, agent_id: `agent-${i}` }));
            }
            
            const results = await Promise.all(promises);
            const duration = Date.now() - startTime;
            
            expect(results.length).toBe(50);
            expect(results.every(r => typeof r === 'string' || r === undefined)).toBe(true);
            expect(duration).toBeLessThan(500); // Should handle concurrency well
            
            console.log(`50 concurrent model rotations completed in ${duration}ms`);
        });

        it('should maintain performance under high load', async () => {
            const startTime = Date.now();
            const operations = [];
            
            // Mix of different operations
            for (let i = 0; i < 100; i++) {
                if (i % 4 === 0) {
                    operations.push(rotateModel(mockAgent));
                } else if (i % 4 === 1) {
                    operations.push(Promise.resolve(setModelScore(`load-model-${i}`, String((i % 100) + 1))));
                } else if (i % 4 === 2) {
                    operations.push(Promise.resolve(getModelScore(`load-model-${i % 10}`)));
                } else {
                    operations.push(OptimizedThoughtDelay.runDelay(10));
                }
            }
            
            await Promise.all(operations);
            const duration = Date.now() - startTime;
            
            expect(duration).toBeLessThan(1000); // Should handle mixed load efficiently
            
            console.log(`100 mixed operations completed in ${duration}ms`);
        });
    });

    describe('Resource Utilization', () => {
        it('should demonstrate memory efficiency of caching', () => {
            const cache = new MechPerformanceCache(30000, 10000);
            
            // Generate many cache entries
            for (let i = 0; i < 1000; i++) {
                cache.getCachedScore(`model-${i}`, 'reasoning', () => i);
            }
            
            const stats = cache.getStats();
            
            expect(stats.scoreEntries).toBe(1000);
            expect(stats.totalEntries).toBe(0); // No weighted total entries were created
            
            // Clear cache and verify cleanup
            cache.clear();
            const clearedStats = cache.getStats();
            
            expect(clearedStats.scoreEntries).toBe(0);
            expect(clearedStats.totalEntries).toBe(0);
            
            console.log(`Cache managed ${stats.scoreEntries} entries efficiently`);
        });

        it('should handle graceful degradation under resource pressure', async () => {
            // Simulate resource pressure by creating many operations
            const operations = [];
            
            for (let i = 0; i < 200; i++) {
                operations.push(
                    rotateModel({
                        name: `PressureAgent-${i}`,
                        agent_id: `pressure-${i}`,
                        created_at: new Date(),
                        tools: []
                    })
                );
            }
            
            const startTime = Date.now();
            const results = await Promise.allSettled(operations);
            const duration = Date.now() - startTime;
            
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            // Should handle most operations successfully
            expect(successful).toBeGreaterThan(190);
            expect(failed).toBeLessThan(10);
            expect(duration).toBeLessThan(2000);
            
            console.log(`Under pressure: ${successful} successful, ${failed} failed in ${duration}ms`);
        });
    });
});