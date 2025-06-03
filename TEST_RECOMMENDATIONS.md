# Test Quality Recommendations for MECH

## Current State

All 128 tests are passing, but there are several quality issues that should be addressed:

### Issues Found

1. **Hardcoded Mock Values**
   - Tests use fixed costs (0.0012) instead of testing actual calculations
   - Model selections are mocked to always return the same model

2. **Over-mocking in E2E Tests**
   - E2E tests mock the entire ensemble module, defeating their purpose
   - Tests verify mock calls rather than actual behavior

3. **Test Workarounds**
   - Comments like "Force the test to complete" indicate bypassed functionality
   - Manual state synchronization in tests (incrementing counters)

4. **Imprecise Assertions**
   - Using `toBeGreaterThan(0)` instead of exact values
   - Arbitrary timeout values without clear reasoning

5. **Dead Code**
   - Unused `createMockStream` functions marked as "No longer need"
   - Inconsistent use of test utilities

## Recommendations

### 1. **Separate Test Levels**
```
tests/
  unit/        # Test individual functions with mocks
  integration/ # Test modules with external services mocked
  e2e/         # Test full system with no internal mocks
```

### 2. **Reduce Mocking**
- Use real `CostTracker` - it's just math calculations
- Use real model selection logic where possible
- Only mock external API calls and I/O operations

### 3. **Test Behavior, Not Implementation**
Instead of:
```typescript
expect(mockedRequest).toHaveBeenCalledTimes(1);
```

Test outcomes:
```typescript
expect(result.history).toContainEqual({
    role: 'assistant',
    content: expect.stringContaining('completed')
});
```

### 4. **Use Precise Assertions**
```typescript
// Instead of
expect(count).toBeGreaterThan(0);

// Use
expect(count).toBe(1); // Exact expected value
```

### 5. **Clean Up Code**
- Remove dead `createMockStream` functions
- Consolidate mock creation patterns
- Remove workaround comments

### 6. **Add Real Integration Tests**
Create tests that:
- Use actual ensemble functionality
- Test with different model configurations
- Verify meta-cognition triggers
- Test real cost calculations

## Priority Actions

1. **High Priority**
   - Remove state synchronization hacks from tests
   - Create at least one true E2E test

2. **Medium Priority**  
   - Reduce mocking in integration tests
   - Use precise assertions
   - Clean up dead code

3. **Low Priority**
   - Reorganize test structure
   - Add performance benchmarks

## Note

The current tests provide good coverage and all functionality works correctly. These recommendations are about improving test quality and maintainability, not fixing broken functionality.