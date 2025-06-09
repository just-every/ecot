# Mind Utilities

This directory contains utility modules that support the Mind system.

## Module Overview

### `constants.ts`
System-wide constants and configuration values.
- Valid meta-cognition frequencies (5, 10, 20, 40)
- Valid thought delay options (0-128 seconds)
- Default values and score limits

### `errors.ts`
Simplified error handling system.
- `MindError` - Structured error class with component context
- `MindValidationError` - Specialized validation error class
- `withErrorHandling` - Utility wrapper for error-prone functions

### `validation.ts`
Input validation for system parameters.
- Model score validation (0-100 range)
- Meta-cognition frequency validation
- Thought delay validation

## Current Structure

Mind has been significantly simplified from its original design. The utilities now focus on:

1. **Constants**: Core system values and types
2. **Validation**: Parameter validation with clear error messages  
3. **Error Handling**: Structured errors for debugging

## Usage in Mind

The utilities support Mind's simplified API:

```typescript
import { mindTask, setMetaFrequency, setThoughtDelay } from '@just-every/mind';
import { Agent } from '@just-every/ensemble';

// Set system parameters
setMetaFrequency('10'); // Every 10 LLM requests
setThoughtDelay('2');   // 2 second delays

// Run Mind
const agent = new Agent({ name: 'MyBot' });
for await (const event of mindTask(agent, 'Task description')) {
    console.log(event);
}
```

## Design Philosophy

1. **Simplicity**: Minimal abstractions, maximum clarity
2. **Type Safety**: Full TypeScript support
3. **Validation**: Clear error messages for invalid inputs
4. **Lightweight**: No complex caching or optimization layers