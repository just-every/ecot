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

### Release
```bash
npm run release:patch  # Patch version bump (1.0.1 -> 1.0.2)
npm run release:minor  # Minor version bump (1.0.1 -> 1.1.0)
npm run release:major  # Major version bump (1.0.1 -> 2.0.0)
```

### Examples
```bash
npm run build && node dist/examples/simple-mech.js
```

## Architecture Overview

ECOT (Ensemble Chain-of-Thought) is an advanced LLM orchestration system built on top of `@just-every/ensemble`. The architecture consists of several key components:

### Core Flow
1. **Simple API** (`simple.ts`) - Provides minimal setup interface for most users
   - `runMECH()` - Basic execution without memory
   - `runMECHWithMemory()` - Execution with memory features
   - Automatically creates full `MechContext` from minimal options

2. **MECH Tools** (`mech_tools.ts`) - Core execution engine
   - Manages the main execution loop
   - Coordinates model rotation, meta-cognition, and thought delays
   - Provides task completion tools (`task_complete`, `task_fatal_error`)

3. **State Management** (`mech_state.ts`) - Global state and configuration
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

- **MechAgent**: Minimal agent interface requiring only name, agent_id, and basic methods
- **MechContext**: Full context with all required functions (most provided by internal utils)
- **SimpleMechOptions**: Minimal options for simple API - just `runAgent` function required

### Integration Pattern

The system expects users to provide:
1. An agent (can be as simple as `{ name: 'MyAgent' }`)
2. A task description
3. A `runAgent` function that calls their LLM

Everything else (history management, cost tracking, tool creation, etc.) is handled internally through `createFullContext()` in `utils/internal_utils.ts`.