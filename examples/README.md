# MECH Examples

This directory contains examples demonstrating the Meta-cognition Ensemble Chain-of-thought Hierarchy (MECH) system.

## Important: API Keys Required

MECH now uses `@just-every/ensemble` for LLM communication. Before running examples, ensure you have API keys configured in your environment:

```bash
export OPENAI_API_KEY="your-openai-key"
export ANTHROPIC_API_KEY="your-anthropic-key"
export GOOGLE_API_KEY="your-google-key"
```

MECH will automatically select the best available model based on your configured keys.

## Running Examples

Build MECH first, then run examples:

```bash
# From the mech directory
npm run build
node dist/examples/simple-mech.js
```

## Examples Overview

### 1. Simple MECH (`simple-mech.ts`)
The simplest way to use MECH with minimal setup.

**Key concepts:**
- Basic MECH configuration
- Simple agent definition
- Status and history callbacks
- Automatic LLM integration via ensemble

### 2. MECH with Memory (`mech-with-memory.ts`)
Demonstrates memory features for context-aware task execution.

**Key concepts:**
- Embedding generation
- Memory lookup and storage
- Context enrichment
- Memory-aware responses

### 3. Meta-cognition (`meta-cognition.ts`)
Shows MECH's self-reflection and model rotation capabilities.

**Key concepts:**
- Meta-cognition frequency
- Model scoring and rotation
- Automatic model selection
- Performance tracking

### 4. Thought Management (`thought-management.ts`)
Demonstrates thought delays and interruption handling.

**Key concepts:**
- Configurable thought delays
- Thought interruption
- Timing and performance
- Reasoning flow control

## Core Concepts

### Simple API
```typescript
import { runMECH } from '@just-every/mech';

const result = await runMECH({
    agent: { name: 'MyBot' },
    task: 'Solve this problem'
});
```

### Advanced API
```typescript
import { runMECHAdvanced } from '@just-every/mech';

const context: MechContext = {
    // Required functions
    sendComms: (msg) => { /* ... */ },
    getCommunicationManager: () => { /* ... */ },
    // ... other required functions
};

const result = await runMECHAdvanced(agent, task, context);
```

### Meta-cognition Control
```typescript
import { setMetaFrequency, mechState } from '@just-every/mech';

// Run meta-cognition every 10 LLM calls
setMetaFrequency('10');

// Check current state
console.log(mechState.metaFrequency);
console.log(mechState.llmRequestCount);
```

### Thought Delays
```typescript
import { setThoughtDelay, getThoughtDelay } from '@just-every/mech';

// Set 4-second delay between thoughts
setThoughtDelay('4');

// Check current delay
const currentDelay = getThoughtDelay(); // Returns '4'
```

## Integration Tips

1. **Start Simple**: Use `runMECH` for basic tasks
2. **Add Memory**: Include embedding functions for context awareness
3. **Enable Meta-cognition**: Let MECH self-optimize with meta-cognition
4. **Custom Context**: Build full `MechContext` for advanced features

## Common Patterns

### Memory Integration
```typescript
const options = {
    // ... other options
    embed: async (text) => generateEmbedding(text),
    lookupMemories: async (embedding) => searchMemories(embedding),
    saveMemory: async (taskId, memories) => storeMemories(taskId, memories)
};
```

### Status Monitoring
```typescript
onStatus: (status) => {
    switch (status.type) {
        case 'meta_cognition_triggered':
            console.log('Meta-cognition running...');
            break;
        case 'model_rotated':
            console.log('Switched to:', status.model);
            break;
    }
}
```