# MECH Utilities

This directory contains utility modules that support the MECH (Meta-cognition Ensemble Chain-of-thought Hierarchy) system.

## Module Overview

### `constants.ts`
System-wide constants and configuration values.
- Valid meta-cognition frequencies (5, 10, 20, 40)
- Valid thought delay options (0-128 seconds)
- Default values and score limits

### `errors.ts`
Simplified error handling system.
- `MechError` - Structured error class with component context
- `MechValidationError` - Specialized validation error class
- `withErrorHandling` - Utility wrapper for error-prone functions

### `validation.ts`
Input validation for system parameters.
- Model score validation (0-100 range)
- Meta-cognition frequency validation
- Thought delay validation

## Current Structure

MECH has been significantly simplified from its original design. The utilities now focus on:

1. **Constants**: Core system values and types
2. **Validation**: Parameter validation with clear error messages  
3. **Error Handling**: Structured errors for debugging

## Usage in MECH

The utilities support MECH's simplified API:

```typescript
import { runMECH, setMetaFrequency, setThoughtDelay } from '@just-every/mech';
import { Agent } from '@just-every/ensemble';

// Set system parameters
setMetaFrequency('10'); // Every 10 LLM requests
setThoughtDelay('2');   // 2 second delays

// Run MECH
const agent = new Agent({ name: 'MyBot' });
for await (const event of runMECH(agent, 'Task description')) {
    console.log(event);
}
```

## Design Philosophy

1. **Simplicity**: Minimal abstractions, maximum clarity
2. **Type Safety**: Full TypeScript support
3. **Validation**: Clear error messages for invalid inputs
4. **Lightweight**: No complex caching or optimization layers