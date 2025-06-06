/**
 * Request context implementation to replace removed ensemble functionality
 */

import type { ResponseInput } from '@just-every/ensemble';

export interface RequestContext {
    messages: ResponseInput;
    metadata: Record<string, any>;
    counters: Record<string, number>;
    modelScores: Record<string, number>;
    disabledModels: Set<string>;
    isHalted: boolean;
    
    incrementCounter(name: string): number;
    getCounter(name: string): number;
    updateScore(model: string, score: number): void;
    getAllScores(): Record<string, number>;
    disableModel(model: string): void;
    isModelDisabled(model: string): boolean;
    getDisabledModels(): string[];
    setMetadata<T>(key: string, value: T): void;
    getMetadata<T>(key: string): T | undefined;
    halt(): void;
}

export function createRequestContext(options: {
    messages: ResponseInput;
    metadata?: Record<string, any>;
    onHalt?: () => void;
}): RequestContext {
    const context: RequestContext = {
        messages: options.messages,
        metadata: options.metadata || {},
        counters: {},
        modelScores: {},
        disabledModels: new Set(),
        isHalted: false,
        
        incrementCounter(name: string): number {
            if (!context.counters[name]) {
                context.counters[name] = 0;
            }
            context.counters[name]++;
            return context.counters[name];
        },
        
        getCounter(name: string): number {
            return context.counters[name] || 0;
        },
        
        updateScore(model: string, score: number): void {
            context.modelScores[model] = score;
        },
        
        getAllScores(): Record<string, number> {
            return { ...context.modelScores };
        },
        
        disableModel(model: string): void {
            context.disabledModels.add(model);
        },
        
        isModelDisabled(model: string): boolean {
            return context.disabledModels.has(model);
        },
        
        getDisabledModels(): string[] {
            return Array.from(context.disabledModels);
        },
        
        setMetadata<T>(key: string, value: T): void {
            context.metadata[key] = value;
        },
        
        getMetadata<T>(key: string): T | undefined {
            return context.metadata[key] as T | undefined;
        },
        
        halt(): void {
            context.isHalted = true;
            if (options.onHalt) {
                options.onHalt();
            }
        }
    };
    
    return context;
}