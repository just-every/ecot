# Task Event Format

## Overview

Task events now include complete state information for full resumability:

```typescript
interface TaskEvent {
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
```

## Benefits

1. **Full Resumability**: The entire conversation and state can be restored
2. **State Persistence**: Save `finalState` to resume tasks later
3. **Error Recovery**: Even errors include state for debugging/retry
4. **Conversation History**: Complete message history for context

## Usage Examples

### Basic Task Completion

```typescript
for await (const event of runTask(agent, task)) {
    if (event.type === 'task_complete') {
        console.log('Result:', event.result);
        console.log('Final state:', event.finalState);
        // Save finalState to database for later
    }
}
```

### Resuming a Task

```typescript
// Option 1: Using resumeTask helper
const event = await resumeTask(agent, savedFinalState, 'Continue working');

// Option 2: Using runTask with full state
const event = await runTask(agent, 'Continue', {
    metaFrequency: savedFinalState.metaFrequency,
    thoughtDelay: savedFinalState.thoughtDelay,
    disabledModels: savedFinalState.disabledModels,
    modelScores: savedFinalState.modelScores,
    messages: savedFinalState.messages
});
```

### Error Recovery

```typescript
for await (const event of runTask(agent, task)) {
    if (event.type === 'task_fatal_error') {
        console.error('Error:', event.result);
        
        // Can retry with modified state
        const retryState = {
            ...event.finalState,
            thoughtDelay: '8', // Give more time to think
            modelScores: {
                ...event.finalState.modelScores,
                'gpt-4': 100 // Prefer more capable model
            }
        };
        
        // Retry with state
        await runTask(agent, 'Please try again more carefully', retryState);
    }
}
```

## State Persistence

Save and restore tasks across sessions:

```typescript
// Save to database
async function saveTask(taskId: string, finalState: TaskEvent['finalState']) {
    await db.tasks.update(taskId, {
        state: JSON.stringify(finalState),
        updatedAt: new Date()
    });
}

// Restore from database
async function loadTask(taskId: string): Promise<TaskEvent['finalState']> {
    const task = await db.tasks.findOne(taskId);
    return JSON.parse(task.state);
}

// Resume later
const savedState = await loadTask('task-123');
for await (const event of resumeTask(agent, savedState)) {
    // Continues exactly where it left off
}
```

## Migration from Old Format

If you're migrating from the old format without finalState:

```typescript
// Old format (before)
if (event.type === 'task_complete') {
    console.log(event.result);
}

// New format (after)
if (event.type === 'task_complete') {
    console.log(event.result);
    console.log(event.finalState); // Now available!
}
```