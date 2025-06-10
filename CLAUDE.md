# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build
```bash
npm run build     # Build TypeScript to dist/
npm run watch     # Build with watch mode
npm run clean     # Clean dist/ directory
```

### Test
```bash
npm test          # Run all tests with Vitest
npm test <file>   # Run specific test file (e.g., npm test mech_state.test.ts)
```

### Pre-Commit Workflow
**IMPORTANT**: Always run these commands before committing and pushing:
```bash
npm test          # Ensure all tests pass (118 tests expected)
npm run build     # Ensure TypeScript compiles without errors
```
Only commit and push if both commands succeed without errors.

### Release
```bash
npm run release:patch  # Patch version bump (1.0.1 -> 1.0.2)
npm run release:minor  # Minor version bump (1.0.1 -> 1.1.0)
npm run release:major  # Major version bump (1.0.1 -> 2.0.0)
```

### Examples
```bash
npm run build && node dist/examples/simple-mind.js
```

## Architecture Overview

Task is an advanced LLM orchestration system built on top of `@just-every/ensemble`. The architecture consists of several key components:

### Core Flow
1. **Simple API** (`engine.ts`) - Provides minimal setup interface for most users
   - `runTask()` - Unified function for execution
   - Integrates with ensemble's pause/resume capabilities
   - Automatically manages meta-cognition and thought delays

2. **Task Tools** - Core execution tools
   - Integrated directly in engine.ts
   - Provides task completion tools (`task_complete`, `task_fatal_error`)
   - Coordinates meta-cognition and thought delays

3. **State Management** (`state.ts`) - Global state and configuration
   - Tracks LLM request counts for meta-cognition triggers
   - Manages model scores and disabled models
   - Configurable meta-frequency (5, 10, 20, or 40 requests)

4. **Model Rotation** (`model_rotation.ts`) - Hierarchical model selection
   - Selects models based on weighted scores (0-100)
   - Ensures model diversity by avoiding consecutive use
   - Falls back through model classes if needed

5. **Meta-cognition** (`meta_cognition.ts`) - Self-reflection system
   - Periodically analyzes agent performance
   - Can adjust model scores, disable models, or inject strategic thoughts
   - Uses specialized meta-cognition tools

6. **Thought Management** (`thought_utils.ts`) - Pacing control
   - Configurable delays between thoughts (0-128 seconds)
   - Interruptible delays with proper abort handling
   - Thought management tools for dynamic control

### Key Interfaces

- **Agent**: Uses ensemble's Agent directly
- **MindState**: State container for meta-cognition and model management
- **runTask**: Single entry point for all Task functionality

### Integration Pattern

The system expects users to provide:
1. An agent (from `@just-every/ensemble`)
2. A task description

Everything else (meta-cognition, thought delays, model rotation via ensemble) is handled automatically.