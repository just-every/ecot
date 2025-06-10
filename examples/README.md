# Mind Examples

This directory contains examples demonstrating the Meta-cognition Ensemble Chain-of-thought Hierarchy (Mind) system.

## Important: API Keys Required

Mind uses `@just-every/ensemble` for LLM communication. Before running examples, ensure you have API keys configured in your environment:

```bash
export OPENAI_API_KEY="your-openai-key"
export ANTHROPIC_API_KEY="your-anthropic-key" 
export GOOGLE_API_KEY="your-google-key"
```

Mind will automatically select the best available model based on your configured keys.

## Running Examples

Build Mind first, then run examples:

```bash
# From the mind directory
npm run build
node dist/examples/simple-mind.js
node dist/examples/meta-cognition.js
node dist/examples/thought-management.js
node dist/examples/custom-tools.js
node dist/examples/pause-control.js
```

## Examples Overview

### 1. Simple Mind (`simple-mind.ts`)
The simplest way to use Mind with minimal setup. Demonstrates the basic async generator API.

**Key concepts:**
- Basic Mind configuration with `runTask(agent, task)`
- Event streaming with `AsyncGenerator<ProviderStreamEvent>`
- Simple agent definition using ensemble's `Agent` class
- Real-time event processing

### 2. Meta-cognition (`meta-cognition.ts`)
Shows Mind's self-reflection and model rotation capabilities.

**Key concepts:**
- Meta-cognition frequency configuration
- Model scoring and performance tracking
- Automatic model selection optimization
- State management with `setMetaFrequency` and model scores

### 3. Thought Management (`thought-management.ts`)
Demonstrates thought delays and timing control.

**Key concepts:**
- Configurable thought delays between agent iterations
- Timing control with `setThoughtDelay`
- Flow control for reasoning processes
- Performance monitoring

### 4. Custom Tools (`custom-tools.ts`)
Shows how to add custom tools to Mind agents.

**Key concepts:**
- Creating tools with `createToolFunction` from ensemble
- Adding tools to agent definitions
- Tool call tracking in event streams
- Custom functionality integration

### 5. Pause Control (`pause-control.ts`)
Demonstrates ensemble's pause/resume functionality with Mind.

**Key concepts:**
- Global pause/resume control with `pause()` and `resume()`
- Automatic pause handling in Mind loops
- Pause event listeners with `getPauseController()`
- Real-time pause state monitoring

## Core API

### Basic Usage
```typescript
import { runTask } from '@just-every/task';

// runTask returns an AsyncGenerator<ProviderStreamEvent>
for await (const event of runTask({ modelClass: 'reasoning' }, 'Solve this problem')) {
    if (event.type === 'task_complete') {
        process.stdout.write(event.content);
    }
}
```

### Meta-cognition Control
```typescript
import { setMetaFrequency, setModelScore, listModelScores } from '@just-every/task';

// Run meta-cognition every 5 LLM calls
setMetaFrequency('5');

// Set model performance scores (0-100)
setModelScore('gpt-4', '85');
setModelScore('claude-3-5-sonnet-20241022', '90');

// View current scores
console.log(listModelScores());
```

### Thought Delays
```typescript
import { setThoughtDelay, getThoughtDelay } from '@just-every/task';

// Set 2-second delay between thoughts
setThoughtDelay('2');

// Check current delay
const currentDelay = getThoughtDelay(); // Returns '2'
```

### Pause Control
```typescript
import { pause, resume, isPaused, getPauseController } from '@just-every/task';

// Pause all LLM requests globally
pause();

// Check if paused
if (isPaused()) {
    console.log('System is paused');
}

// Resume all requests
resume();

// Listen to pause events
const controller = getPauseController();
controller.on('paused', () => console.log('Paused!'));
controller.on('resumed', () => console.log('Resumed!'));
```

### Custom Tools
```typescript
import { createToolFunction } from '@just-every/ensemble';

const myTool = createToolFunction(
    (args: { input: string }) => `Processed: ${args.input}`,
    'Process some input',
    { input: { type: 'string', description: 'Input to process' } },
    undefined,
    'my_tool'
);

const agent = new Agent({
    name: 'ToolBot',
    tools: [myTool]
});
```

## Event Types

The `runTask` async generator yields various event types:

- `message_delta`: Streaming text content from the LLM
- `tool_start`: Tool call begins
- `tool_done`: Tool call completes (including `task_complete`)
- `response_start`: New LLM request begins
- `response_output`: LLM response completed
- `cost_update`: Token usage and cost information
- `error`: Error occurred

## Integration Tips

1. **Start Simple**: Use `runTask(agent, task)` for basic tasks
2. **Event Handling**: Process events in real-time for responsive UIs
3. **Meta-cognition**: Configure frequency and model scores for optimization
4. **Thought Timing**: Use delays for paced reasoning or rate limiting
5. **Custom Tools**: Extend agent capabilities with domain-specific tools

## State Management

Mind maintains global state that persists across executions:

```typescript
import { mindState, resetLLMRequestCount } from '@just-every/task';

// Check current state
console.log(`LLM requests: ${mindState.llmRequestCount}`);
console.log(`Meta frequency: ${mindState.metaFrequency}`);
console.log(`Disabled models: ${Array.from(mindState.disabledModels)}`);

// Reset counters
resetLLMRequestCount();
```