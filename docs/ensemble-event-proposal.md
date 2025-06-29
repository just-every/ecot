# Proposed Ensemble Event Format

## Current Issues
- Events are not extensible without breaking changes
- No standard way to attach implementation-specific data
- `result` field is ambiguous for errors

## Recommended Format

```typescript
// In ensemble
export interface TaskCompleteEvent<TData = unknown> extends StreamEventBase {
    type: 'task_complete' | 'task_fatal_error';
    result: string;
    finalState: {
        metaFrequency: string;
        thoughtDelay: string;
        disabledModels: string[];
        modelScores: Record<string, number>;
        messages: ResponseInput;
    };
}

export interface TaskFatalErrorEvent<TData = unknown> extends StreamEventBase {
    type: 'task_fatal_error';
    error: string;        // The error message
    errorCode?: string;   // Optional error code (e.g., 'TIMEOUT', 'INVALID_INPUT')
    /** Extensible data field for implementation-specific state */
    data?: TData;
}

export type TaskEvent<TData = unknown> = 
    | TaskCompleteEvent<TData> 
    | TaskFatalErrorEvent<TData>;
```

## Usage in Task Package

```typescript
// Define our state data structure
interface TaskStateData {
    finalState: {
        metaFrequency: string;
        thoughtDelay: string;
        disabledModels: string[];
        modelScores: Record<string, number>;
    };
}

// Emit events with our data
const completeEvent: TaskCompleteEvent<TaskStateData> = {
    type: 'task_complete',
    result: 'Successfully analyzed the code',
    data: {
        finalState: {
            metaFrequency: '10',
            thoughtDelay: '2',
            disabledModels: [],
            modelScores: { 'gpt-4': 90 }
        }
    }
};

// Type-safe event handling
for await (const event of runTask(agent, task)) {
    if (event.type === 'task_complete') {
        // event is TaskCompleteEvent<TaskStateData>
        console.log(event.result);
        console.log(event.data?.finalState);
    }
}
```

## Benefits

1. **Extensible**: The `data` field allows any implementation to attach custom data
2. **Type-safe**: Generic parameter ensures type safety for custom data
3. **Backward compatible**: Existing code that doesn't use `data` continues to work
4. **Semantic**: `error` field for errors is clearer than `result`
5. **Future-proof**: Can add more standard fields without breaking changes

## Migration Path

1. Add new event types to ensemble with generic `data` field
2. Keep old events for backward compatibility
3. Update Task to use new events with `TaskStateData`
4. Deprecate old events in future version

## Alternative: Metadata Approach

If we want to standardize some common fields:

```typescript
export interface TaskEventMetadata {
    duration?: number;
    model?: string;
    tokenCount?: number;
    cost?: number;
}

export interface TaskCompleteEvent<TData = unknown> extends StreamEventBase {
    type: 'task_complete';
    result: string;
    metadata?: TaskEventMetadata;
    data?: TData;
}
```

This separates ensemble-standard metadata from implementation-specific data.