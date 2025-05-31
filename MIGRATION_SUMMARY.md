# Migration Summary: runMECHWithMemory to runMECH

## Changes Made

This migration consolidates the `runMECHWithMemory` function into the main `runMECH` function, simplifying the API while maintaining all functionality.

### Files Updated

1. **test/integration.test.ts**
   - Removed import of `runMECHWithMemory` and `SimpleMechWithMemoryOptions`
   - Updated all calls from `runMECHWithMemory` to `runMECH`
   - Changed type annotations from `SimpleMechWithMemoryOptions` to `RunMechOptions`

2. **test/e2e.test.ts**
   - Removed import of `runMECHWithMemory` and `SimpleMechWithMemoryOptions`
   - Updated all calls from `runMECHWithMemory` to `runMECH`
   - Changed type annotations from `SimpleMechWithMemoryOptions` to `RunMechOptions`

3. **examples/mech-with-memory.ts**
   - Updated import from `runMECHWithMemory` to `runMECH`
   - Changed type from `SimpleMechWithMemoryOptions` to `RunMechOptions`
   - Updated function call from `runMECHWithMemory` to `runMECH`

4. **examples/basic-example.ts**
   - Removed import of `runMECHWithMemory`
   - Updated memory example to use `runMECH` instead

5. **utils/validation.ts**
   - Updated import to include `RunMechOptions` instead of `SimpleMechWithMemoryOptions`
   - Updated validation function signature (though the function itself is not currently used)

### API Changes

#### Before
```typescript
// Two separate functions
await runMECH(options);
await runMECHWithMemory(optionsWithMemory);
```

#### After
```typescript
// Single unified function
await runMECH(options); // Works with or without memory features
```

### Memory Features

Memory features are now available directly in `RunMechOptions`:

```typescript
interface RunMechOptions {
  agent: SimpleAgent;
  task: string;
  runAgent: (agent, input, history) => Promise<LLMResponse>;
  
  // Optional memory features
  embed?: (text: string) => Promise<number[]>;
  lookupMemories?: (embedding: number[]) => Promise<MemoryItem[]>;
  saveMemory?: (taskId: string, memories: MemoryItem[]) => Promise<void>;
  
  // Other optional features...
}
```

### Backwards Compatibility

- `runMECHWithMemory` is still available as `runMECHWithMemoryAdvanced` from the advanced API exports in `index.ts`
- The underlying `mech_memory_wrapper.ts` functionality remains unchanged
- All existing features continue to work as before

### Test Results

All tests pass after the migration:
- ✅ Integration tests
- ✅ E2E tests  
- ✅ Simple API tests
- ✅ All unit tests

No functionality has been lost in this consolidation.