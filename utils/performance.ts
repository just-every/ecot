/**
 * MECH Performance Optimizations
 * 
 * Caching and performance improvements for MECH operations
 */

import type { ModelClassID } from '@just-every/ensemble';

/**
 * Cache entry for model scores
 */
interface ModelScoreCacheEntry {
    score: number;
    expiry: number;
}

/**
 * Cache entry for weighted totals
 */
interface WeightedTotalCacheEntry {
    total: number;
    modelList: string[];
    lastUpdated: number;
}

/**
 * Performance cache manager for MECH operations
 * 
 * Provides intelligent caching for expensive operations in the MECH system:
 * - Model score calculations with configurable TTL
 * - Weighted total computations for model selection
 * - Automatic cache cleanup and invalidation
 * 
 * Significantly improves performance by avoiding redundant score calculations
 * during model rotation and selection processes.
 * 
 * @example
 * ```typescript
 * const cache = new MechPerformanceCache(30000, 5000); // 30s scores, 5s totals
 * 
 * // Cached score retrieval
 * const score = cache.getCachedScore('gpt-4', 'reasoning', () => calculateScore());
 * 
 * // Manual cache management
 * cache.invalidateModel('gpt-4');
 * cache.clear();
 * ```
 */
export class MechPerformanceCache {
    private modelScoreCache = new Map<string, ModelScoreCacheEntry>();
    private weightedTotalCache = new Map<string, WeightedTotalCacheEntry>();
    private cleanupInterval: NodeJS.Timeout;
    
    // Cache statistics
    private scoreCacheHits = 0;
    private scoreCacheRequests = 0;
    private totalCacheHits = 0;
    private totalCacheRequests = 0;
    
    constructor(
        private readonly scoreCacheTtl: number = 30000, // 30 seconds
        private readonly totalCacheTtl: number = 5000   // 5 seconds
    ) {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000); // 1 minute
    }

    /**
     * Get cached model score or compute and cache it
     */
    getCachedScore(
        modelId: string, 
        modelClass: ModelClassID | undefined,
        computeFn: () => number
    ): number {
        this.scoreCacheRequests++;
        const key = `${modelId}:${modelClass || 'default'}`;
        const cached = this.modelScoreCache.get(key);
        
        if (cached && Date.now() < cached.expiry) {
            this.scoreCacheHits++;
            return cached.score;
        }
        
        const score = computeFn();
        this.modelScoreCache.set(key, {
            score,
            expiry: Date.now() + this.scoreCacheTtl
        });
        
        return score;
    }

    /**
     * Get cached weighted total or compute and cache it
     */
    getCachedWeightedTotal(
        models: string[], 
        modelClass: ModelClassID | undefined,
        computeFn: () => number
    ): number {
        this.totalCacheRequests++;
        const sortedModels = [...models].sort();
        const key = `${sortedModels.join(',')}:${modelClass || 'default'}`;
        const cached = this.weightedTotalCache.get(key);
        
        if (cached && 
            Date.now() - cached.lastUpdated < this.totalCacheTtl &&
            this.arraysEqual(cached.modelList, sortedModels)) {
            this.totalCacheHits++;
            return cached.total;
        }
        
        const total = computeFn();
        this.weightedTotalCache.set(key, {
            total,
            modelList: sortedModels,
            lastUpdated: Date.now()
        });
        
        return total;
    }

    /**
     * Invalidate caches for a specific model
     */
    invalidateModel(modelId: string): void {
        // Remove all entries containing this model ID
        for (const [key] of this.modelScoreCache) {
            if (key.startsWith(`${modelId}:`)) {
                this.modelScoreCache.delete(key);
            }
        }

        // Remove weighted total caches that include this model
        for (const [key, entry] of this.weightedTotalCache) {
            if (entry.modelList.includes(modelId)) {
                this.weightedTotalCache.delete(key);
            }
        }
    }

    /**
     * Clear all caches
     */
    clear(): void {
        this.modelScoreCache.clear();
        this.weightedTotalCache.clear();
        this.scoreCacheHits = 0;
        this.scoreCacheRequests = 0;
        this.totalCacheHits = 0;
        this.totalCacheRequests = 0;
    }

    /**
     * Get cache statistics
     */
    getStats(): {
        scoreEntries: number;
        totalEntries: number;
        scoreHitRate: number;
        totalHitRate: number;
    } {
        return {
            scoreEntries: this.modelScoreCache.size,
            totalEntries: this.weightedTotalCache.size,
            scoreHitRate: this.scoreCacheHits / Math.max(1, this.scoreCacheRequests),
            totalHitRate: this.totalCacheHits / Math.max(1, this.totalCacheRequests)
        };
    }

    /**
     * Clean up expired cache entries
     */
    private cleanup(): void {
        const now = Date.now();
        
        // Clean up model score cache
        for (const [key, entry] of this.modelScoreCache) {
            if (now >= entry.expiry) {
                this.modelScoreCache.delete(key);
            }
        }

        // Clean up weighted total cache
        for (const [key, entry] of this.weightedTotalCache) {
            if (now - entry.lastUpdated >= this.totalCacheTtl) {
                this.weightedTotalCache.delete(key);
            }
        }
    }

    /**
     * Compare two arrays for equality
     */
    private arraysEqual(a: string[], b: string[]): boolean {
        return a.length === b.length && a.every((val, i) => val === b[i]);
    }


    /**
     * Destroy the cache and cleanup interval
     */
    destroy(): void {
        clearInterval(this.cleanupInterval);
        this.clear();
    }
}

/**
 * Global performance cache instance
 */
export const globalPerformanceCache = new MechPerformanceCache();

/**
 * Optimized thought delay implementation
 */
export class OptimizedThoughtDelay {
    private static activeDelays = new Map<string, {
        controller: AbortController;
        promise: Promise<void>;
    }>();

    /**
     * Run an optimized thought delay
     */
    static async runDelay(
        delayMs: number,
        signal?: AbortSignal,
        onProgress?: (remaining: number) => void
    ): Promise<void> {
        if (delayMs <= 0) return;

        const delayId = `delay_${Date.now()}_${Math.random()}`;
        const controller = new AbortController();
        
        // Combine external and internal abort signals
        const combinedSignal = signal ? this.combineSignals([signal, controller.signal]) : controller.signal;

        const delayPromise = new Promise<void>((resolve) => {
            let timeoutId: NodeJS.Timeout;
            let progressIntervalId: NodeJS.Timeout | undefined;

            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                if (progressIntervalId) clearInterval(progressIntervalId);
                this.activeDelays.delete(delayId);
            };

            // Set up progress reporting if callback provided
            if (onProgress) {
                const startTime = Date.now();
                progressIntervalId = setInterval(() => {
                    const elapsed = Date.now() - startTime;
                    const remaining = Math.max(0, delayMs - elapsed);
                    onProgress(remaining);
                    
                    if (remaining <= 0) {
                        clearInterval(progressIntervalId!);
                    }
                }, 100); // Report progress every 100ms
            }

            // Handle abort
            const abortHandler = () => {
                cleanup();
                resolve();
            };

            combinedSignal.addEventListener('abort', abortHandler, { once: true });

            // Set the main timeout
            timeoutId = setTimeout(() => {
                cleanup();
                resolve();
            }, delayMs);
        });

        // Store the delay for potential cancellation
        this.activeDelays.set(delayId, { controller, promise: delayPromise });

        try {
            await delayPromise;
        } finally {
            this.activeDelays.delete(delayId);
        }
    }

    /**
     * Cancel all active delays
     */
    static cancelAllDelays(): void {
        for (const [, { controller }] of this.activeDelays) {
            controller.abort();
        }
        this.activeDelays.clear();
    }

    /**
     * Get the number of active delays
     */
    static getActiveDelayCount(): number {
        return this.activeDelays.size;
    }

    /**
     * Combine multiple abort signals into one
     */
    private static combineSignals(signals: AbortSignal[]): AbortSignal {
        const controller = new AbortController();
        
        for (const signal of signals) {
            if (signal.aborted) {
                controller.abort();
                break;
            }
            
            signal.addEventListener('abort', () => {
                controller.abort();
            }, { once: true });
        }
        
        return controller.signal;
    }
}

/**
 * Memory pool for frequently allocated objects
 */
export class MechObjectPool<T> {
    private pool: T[] = [];
    private createFn: () => T;
    private resetFn: (obj: T) => void;
    private maxSize: number;

    constructor(
        createFn: () => T,
        resetFn: (obj: T) => void,
        maxSize: number = 100
    ) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.maxSize = maxSize;
    }

    /**
     * Get an object from the pool or create a new one
     */
    acquire(): T {
        const obj = this.pool.pop();
        if (obj) {
            return obj;
        }
        return this.createFn();
    }

    /**
     * Return an object to the pool
     */
    release(obj: T): void {
        if (this.pool.length < this.maxSize) {
            this.resetFn(obj);
            this.pool.push(obj);
        }
    }

    /**
     * Get pool statistics
     */
    getStats(): { poolSize: number; maxSize: number } {
        return {
            poolSize: this.pool.length,
            maxSize: this.maxSize
        };
    }

    /**
     * Clear the pool
     */
    clear(): void {
        this.pool = [];
    }
}

/**
 * Batch processor for operations that can be batched
 */
export class BatchProcessor<T, R> {
    private queue: Array<{
        item: T;
        resolve: (result: R) => void;
        reject: (error: Error) => void;
    }> = [];
    private batchTimeout: NodeJS.Timeout | null = null;

    constructor(
        private readonly processBatch: (items: T[]) => Promise<R[]>,
        private readonly batchSize: number = 10,
        private readonly batchTimeoutMs: number = 100
    ) {}

    /**
     * Add an item to be processed
     */
    async process(item: T): Promise<R> {
        return new Promise<R>((resolve, reject) => {
            this.queue.push({ item, resolve, reject });

            if (this.queue.length >= this.batchSize) {
                this.flush();
            } else if (!this.batchTimeout) {
                this.batchTimeout = setTimeout(() => {
                    this.flush();
                }, this.batchTimeoutMs);
            }
        });
    }

    /**
     * Force process all queued items
     */
    private async flush(): Promise<void> {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }

        if (this.queue.length === 0) return;

        const batch = this.queue.splice(0);
        const items = batch.map(item => item.item);

        try {
            const results = await this.processBatch(items);
            
            if (results.length !== batch.length) {
                throw new Error(`Batch processor returned ${results.length} results for ${batch.length} items`);
            }

            batch.forEach((item, index) => {
                item.resolve(results[index]);
            });
        } catch (error) {
            batch.forEach(item => {
                item.reject(error instanceof Error ? error : new Error(String(error)));
            });
        }
    }

    /**
     * Get queue statistics
     */
    getStats(): { queueSize: number; batchSize: number } {
        return {
            queueSize: this.queue.length,
            batchSize: this.batchSize
        };
    }
}

/**
 * Debounce function calls to reduce unnecessary work
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    waitMs: number
): T {
    let timeoutId: NodeJS.Timeout;
    
    return ((...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        
        return new Promise<ReturnType<T>>((resolve, reject) => {
            timeoutId = setTimeout(async () => {
                try {
                    const result = await func(...args);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            }, waitMs);
        });
    }) as T;
}

/**
 * Throttle function calls to limit execution frequency
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limitMs: number
): T {
    let lastCallTime = 0;
    let timeoutId: NodeJS.Timeout | null = null;
    
    return ((...args: Parameters<T>) => {
        const now = Date.now();
        const timeSinceLastCall = now - lastCallTime;
        
        if (timeSinceLastCall >= limitMs) {
            lastCallTime = now;
            return func(...args);
        } else {
            if (timeoutId) clearTimeout(timeoutId);
            
            return new Promise<ReturnType<T>>((resolve, reject) => {
                timeoutId = setTimeout(async () => {
                    try {
                        lastCallTime = Date.now();
                        const result = await func(...args);
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                }, limitMs - timeSinceLastCall);
            });
        }
    }) as T;
}