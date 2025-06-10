# Task Utilities

This directory contains utility modules that support the Task system.

## Module Overview

### `constants.ts`
System-wide constants and configuration values.
- Valid meta-cognition frequencies (5, 10, 20, 40)
- Valid thought delay options (0-128 seconds)
- Default values and score limits

### `errors.ts`
Simplified error handling system.
- `TaskError` - Structured error class with component context
- `TaskValidationError` - Specialized validation error class
- `withErrorHandling` - Utility wrapper for error-prone functions

### `validation.ts`
Input validation for system parameters.
- Model score validation (0-100 range)
- Meta-cognition frequency validation
- Thought delay validation

## Current Structure

Task has been significantly simplified from its original design. The utilities now focus on:

1. **Constants**: Core system values and types
2. **Validation**: Parameter validation with clear error messages  
3. **Error Handling**: Structured errors for debugging

## Usage in Task

The utilities support Task's simplified API:

```typescript
import { runTask, setMetaFrequency, setThoughtDelay } from '@just-every/task';
import { Agent } from '@just-every/ensemble';

// Set system parameters
setMetaFrequency('10'); // Every 10 LLM requests
setThoughtDelay('2');   // 2 second delays

// Run Task
const agent = new Agent({ name: 'MyBot' });
for await (const event of runTask(agent, 'Task description')) {
    console.log(event);
}
```

## Design Philosophy

1. **Simplicity**: Minimal abstractions, maximum clarity
2. **Type Safety**: Full TypeScript support
3. **Validation**: Clear error messages for invalid inputs
4. **Lightweight**: No complex caching or optimization layers