# Bug Report: EnhancedRequestMock Import Issue in @just-every/ensemble v0.1.32

## Summary
Cannot import `EnhancedRequestMock` from `@just-every/ensemble/test` module as documented due to module resolution issues with Node.js module resolution.

## Bug Details

### Package Information
- **Package**: `@just-every/ensemble`
- **Version**: 0.1.32
- **Affected Module**: Test utilities export

### Description
The test utilities including `EnhancedRequestMock` are exported from a `/test` submodule, but this cannot be imported when using Node.js module resolution (`"moduleResolution": "node"` in tsconfig.json).

### Current Workaround
We have to use the direct path import:
```typescript
import { EnhancedRequestMock } from '@just-every/ensemble/dist/utils/test_utils.js';
```

### Expected Behavior
Should be able to import from the documented `/test` export:
```typescript
import { EnhancedRequestMock } from '@just-every/ensemble/test';
```

### Error Message
When trying to use `@just-every/ensemble/test`:
```
Cannot find module '@just-every/ensemble/test' or its corresponding type declarations.
There are types at '/node_modules/@just-every/ensemble/dist/test.d.ts', but this result could not be resolved under your current 'moduleResolution' setting. Consider updating to 'node16', 'nodenext', or 'bundler'.
```

When running tests with Vitest:
```
Error: Missing "./dist/utils/test_utils.js" specifier in "@just-every/ensemble" package
```

## Impact
- Projects using `"moduleResolution": "node"` cannot use the cleaner `/test` import
- Have to use implementation detail path (`/dist/utils/test_utils.js`)
- Makes code fragile to internal structure changes in ensemble

## Root Cause
The package.json exports are configured for newer module resolution strategies but don't work with the legacy "node" resolution that many projects still use.

## Suggested Fix
Either:
1. Add a compatibility layer for Node.js module resolution
2. Export test utilities from the main module (e.g., `@just-every/ensemble` with a namespace)
3. Document the direct import path as the official way to import test utilities

## Reproduction Steps
1. Create a TypeScript project with `"moduleResolution": "node"`
2. Install `@just-every/ensemble@0.1.32`
3. Try to import: `import { EnhancedRequestMock } from '@just-every/ensemble/test';`
4. Observe TypeScript/build error

## Priority
Medium - Affects developer experience but has a workaround