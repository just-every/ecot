# @just-every/task

Intelligent orchestration layer for @just-every/ensemble agents with meta-cognition and adaptive model selection.

[![npm version](https://badge.fury.io/js/@just-every%2Ftask.svg)](https://www.npmjs.com/package/@just-every/task)
[![GitHub Actions](https://github.com/just-every/task/workflows/Release/badge.svg)](https://github.com/just-every/task/actions)

## Overview

Task adds meta-cognition, adaptive model rotation and cost tracking to your @just-every/ensemble agents in a single call. It automatically selects the best model for each step, monitors performance, and adjusts strategy when needed - all while tracking costs across providers.

Task is designed to make AI agents more reliable and cost-effective by adding a layer of intelligence on top of ensemble's multi-provider capabilities.

## Features

- 🎯 **Automatic Model Rotation** - Performance-based selection across providers
- 🧠 **Meta-cognition** - Agents periodically reflect and self-correct
- 🔄 **Adaptive Strategy** - Detects loops and adjusts approach automatically
- 💰 **Cost Tracking** - Real-time cost monitoring across all providers
- 🛠️ **Zero Configuration** - Works with any ensemble agent and tools
- 📊 **Model Scoring** - Dynamic scoring based on task performance

## Installation

```bash
npm install @just-every/task
```

## Prerequisites

- Node.js 18.x or higher
- At least one LLM provider API key
- @just-every/ensemble (installed as peer dependency)

## Environment Setup

Set your LLM provider API keys (any combination works):

```bash
export OPENAI_API_KEY="your-openai-key"
export ANTHROPIC_API_KEY="your-anthropic-key"
export GOOGLE_API_KEY="your-google-key"
export XAI_API_KEY="your-xai-key"
export DEEPSEEK_API_KEY="your-deepseek-key"
```

## Quick Start

```typescript
import { runTask } from "@just-every/task";
import { Agent } from "@just-every/ensemble";

// Create an agent with a model class
const agent = new Agent({ 
  name: "MyAssistant",
  modelClass: "reasoning",
  instructions: "You are a helpful coding assistant"
});

// Run a task - Task handles everything else
const stream = runTask(agent, "Analyze this code and suggest improvements: ...");

// Process the streaming response
for await (const event of stream) {
  if (event.type === 'message_delta') {
    process.stdout.write(event.content);
  }
}
```

## Usage Examples

### 1. Basic Task Execution

```typescript
import { runTask } from "@just-every/task";
import { Agent } from "@just-every/ensemble";

// Create a simple agent
const agent = new Agent({ 
  modelClass: "standard" 
});

// Execute a task
const stream = runTask(agent, "Write a haiku about programming");

// Handle the response
for await (const event of stream) {
  if (event.type === 'message_delta') {
    process.stdout.write(event.content);
  }
}
```

### 2. Code Analysis with Instructions

```typescript
const codeAgent = new Agent({
  name: "CodeAnalyzer",
  modelClass: "code",
  instructions: `You are an expert code reviewer. Focus on:
    - Performance improvements
    - Security vulnerabilities
    - Code maintainability
    - Best practices`
});

const codeToAnalyze = `
function processData(users) {
  let result = [];
  for (let i = 0; i < users.length; i++) {
    if (users[i].age > 18) {
      result.push(users[i].name);
    }
  }
  return result;
}
`;

const stream = runTask(codeAgent, 
  `Review this code and suggest improvements:\n${codeToAnalyze}`
);
```

### 3. Multi-Step Problem Solving

```typescript
const problemSolver = new Agent({
  modelClass: "reasoning",
  instructions: "Break down complex problems into steps and solve systematically"
});

// Task handles meta-cognition and self-correction automatically
const stream = runTask(problemSolver, `
  I have a dataset of 10,000 customer transactions. I need to:
  1. Identify suspicious patterns
  2. Calculate risk scores
  3. Generate a report with visualizations
  
  Design a solution architecture for this.
`);
```

### 4. Custom Tools Integration

```typescript
import { createToolFunction } from "@just-every/ensemble";

// Create custom tools
const databaseTool = createToolFunction(
  async ({ query }: { query: string }) => {
    // Simulate database query
    return `Query executed: ${query}. Found 42 records.`;
  },
  'Execute database queries',
  {
    query: { 
      type: 'string', 
      description: 'SQL query to execute' 
    }
  },
  undefined,
  'query_database'
);

const apiTool = createToolFunction(
  async ({ endpoint, method }: { endpoint: string; method: string }) => {
    // Simulate API call
    return `API ${method} ${endpoint} returned: {"status": "success", "data": [...]}`;
  },
  'Make API calls',
  {
    endpoint: { type: 'string', description: 'API endpoint' },
    method: { type: 'string', description: 'HTTP method', enum: ['GET', 'POST', 'PUT', 'DELETE'] }
  },
  ['endpoint', 'method'],
  'call_api'
);

// Create agent with tools
const agent = new Agent({
  modelClass: "code",
  tools: [databaseTool, apiTool],
  instructions: "Use the available tools to gather data and complete tasks"
});

// Run task that uses tools
const stream = runTask(agent, 
  "Check the database for users created today and call the analytics API"
);

// Process events including tool calls
for await (const event of stream) {
  if (event.type === 'message_delta') {
    process.stdout.write(event.content);
  } else if (event.type === 'tool_start') {
    console.log(`\n🔧 Using tool: ${event.tool_call?.function?.name}`);
  }
}
```

### 5. Advanced Configuration with MindState

```typescript
import { runTask, MindState } from "@just-every/task";

// Create custom state configuration
const state = new MindState();

// Configure meta-cognition frequency (5, 10, 20, or 40 requests)
state.setMetaFrequency(10);

// Set thought delays (in seconds: 0, 2, 4, 8, 16, 32, 64, 128)
state.setThoughtDelay(4);

// Adjust model scores based on your needs
state.setModelScore('claude-3-5-sonnet-20241022', 95);
state.setModelScore('gpt-4', 85);
state.setModelScore('gemini-1.5-pro', 80);

// Disable specific models if needed
state.disableModel('gpt-3.5-turbo');

const agent = new Agent({
  modelClass: "reasoning",
  instructions: "Think step by step and verify your work"
});

// Run with custom state
const stream = runTask(agent, 
  "Design a distributed system for real-time data processing", 
  state
);

// Monitor execution
for await (const event of stream) {
  if (event.type === 'message_delta') {
    process.stdout.write(event.content);
  } else if (event.type === 'tool_done' && event.tool_call?.function?.name === 'meta_cognition') {
    console.log('\n🧠 Meta-cognition triggered - agent is self-reflecting...');
  }
}
```

### 6. Error Handling and Recovery

```typescript
const resilientAgent = new Agent({
  modelClass: "code",
  instructions: "If you encounter errors, analyze them and try alternative approaches"
});

try {
  const stream = runTask(resilientAgent, "Parse this JSON and handle errors gracefully");
  
  for await (const event of stream) {
    if (event.type === 'message_delta') {
      process.stdout.write(event.content);
    } else if (event.type === 'tool_done') {
      const toolName = event.tool_call?.function?.name;
      
      if (toolName === 'task_fatal_error') {
        console.error('\n❌ Fatal error encountered:', event.result);
        // Handle fatal errors appropriately
        break;
      } else if (toolName === 'task_complete') {
        console.log('\n✅ Task completed successfully');
        break;
      }
    }
  }
} catch (error) {
  console.error('Unexpected error:', error);
}
```

### 7. Real-World Example: Data Processing Pipeline

```typescript
import { Agent, createToolFunction } from "@just-every/ensemble";
import { runTask, MindState } from "@just-every/task";

// Create data processing tools
const tools = [
  createToolFunction(
    async ({ filename }: { filename: string }) => {
      // Simulate reading CSV
      return `Read 1000 rows from ${filename}`;
    },
    'Read CSV file',
    { filename: { type: 'string' } },
    undefined,
    'read_csv'
  ),
  
  createToolFunction(
    async ({ data, operation }: { data: string; operation: string }) => {
      return `Transformed data using ${operation}`;
    },
    'Transform data',
    { 
      data: { type: 'string' },
      operation: { type: 'string', enum: ['normalize', 'aggregate', 'filter'] }
    },
    ['data', 'operation'],
    'transform_data'
  ),
  
  createToolFunction(
    async ({ data, format }: { data: string; format: string }) => {
      return `Exported data to ${format} format`;
    },
    'Export processed data',
    {
      data: { type: 'string' },
      format: { type: 'string', enum: ['json', 'csv', 'parquet'] }
    },
    ['data', 'format'],
    'export_data'
  )
];

// Configure agent
const dataAgent = new Agent({
  name: "DataProcessor",
  modelClass: "code",
  tools,
  instructions: `You are a data processing expert. When given a data task:
    1. Read the input data
    2. Apply appropriate transformations
    3. Export in the requested format
    4. Provide a summary of what was done`
});

// Configure state for longer tasks
const state = new MindState();
state.setMetaFrequency(20); // Less frequent meta-cognition for focused work
state.setThoughtDelay(2); // Quick thinking for data tasks

// Execute complex data pipeline
const stream = runTask(dataAgent, `
  Process the sales_data.csv file:
  - Normalize the revenue columns
  - Aggregate by region and product category
  - Export as both JSON and Parquet formats
  - Include data quality metrics in your summary
`, state);

// Track progress
let toolCalls = 0;
for await (const event of stream) {
  if (event.type === 'message_delta') {
    process.stdout.write(event.content);
  } else if (event.type === 'tool_start') {
    toolCalls++;
    console.log(`\n[Step ${toolCalls}] ${event.tool_call?.function?.name}`);
  }
}
```

### Model Classes

| Class | Use Cases | Example Models |
|-------|-----------|----------------|
| `reasoning` | Complex logic, multi-step problems | o1, claude-3-opus |
| `code` | Code generation, review, debugging | gpt-4, claude-3-sonnet |
| `standard` | General tasks, writing, Q&A | gpt-3.5, claude-3-haiku |

## Common Patterns

### Streaming Output with Progress

```typescript
const stream = runTask(agent, task);
let totalTokens = 0;

for await (const event of stream) {
  switch (event.type) {
    case 'message_delta':
      process.stdout.write(event.content);
      break;
    case 'tool_start':
      console.log(`\n🔧 ${event.tool_call?.function?.name} started`);
      break;
    case 'tool_done':
      if (event.tool_call?.function?.name === 'task_complete') {
        console.log(`\n✅ Complete! Total tokens: ${totalTokens}`);
      }
      break;
    case 'usage':
      totalTokens += event.usage?.total_tokens || 0;
      break;
  }
}
```

### Handling Different Task Types

```typescript
// For analysis tasks - use reasoning model with meta-cognition
const analysisAgent = new Agent({ modelClass: "reasoning" });
const analysisState = new MindState();
analysisState.setMetaFrequency(5); // Frequent self-checking

// For creative tasks - use standard model with thought delays
const creativeAgent = new Agent({ modelClass: "standard" });
const creativeState = new MindState();
creativeState.setThoughtDelay(8); // Slower, more deliberate

// For coding tasks - use code model with minimal delays
const codingAgent = new Agent({ modelClass: "code" });
const codingState = new MindState();
codingState.setThoughtDelay(0); // Fast execution
```

### Building Reusable Agents

```typescript
// Create a reusable agent factory
function createSpecializedAgent(specialty: string) {
  const configs = {
    researcher: {
      modelClass: "reasoning" as const,
      instructions: "Research thoroughly and cite sources",
      metaFrequency: 10,
      thoughtDelay: 4
    },
    developer: {
      modelClass: "code" as const,
      instructions: "Write clean, tested, documented code",
      metaFrequency: 20,
      thoughtDelay: 2
    },
    writer: {
      modelClass: "standard" as const,
      instructions: "Write engaging, clear content",
      metaFrequency: 40,
      thoughtDelay: 8
    }
  };
  
  const config = configs[specialty as keyof typeof configs];
  const agent = new Agent({
    modelClass: config.modelClass,
    instructions: config.instructions
  });
  
  const state = new MindState();
  state.setMetaFrequency(config.metaFrequency);
  state.setThoughtDelay(config.thoughtDelay);
  
  return { agent, state };
}

// Use the factory
const { agent, state } = createSpecializedAgent('researcher');
const stream = runTask(agent, "Research quantum computing applications", state);
```

## API Reference

### `runTask(agent, task, state?)`

Main function to execute tasks with intelligent orchestration.

- **agent**: An ensemble Agent instance with tools and model class
- **task**: String description of the task to complete
- **state**: Optional MindState instance for custom configuration
- **Returns**: AsyncIterable stream of events

### `MindState`

Configuration and state management class.

- **metaFrequency**: How often meta-cognition runs (5, 10, 20, or 40)
- **thoughtDelay**: Milliseconds between thoughts (0-128000)
- **disabledModels**: Set of model IDs to exclude
- **modelScores**: Map of model ID to performance score

## Architecture

Task builds on top of ensemble to provide:

1. **Model Selection** - Weighted random selection based on scores
2. **Meta-cognition** - Periodic self-reflection and strategy adjustment
3. **State Management** - Tracks performance and adjusts parameters
4. **Tool Integration** - Seamlessly works with ensemble tools

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run examples
npm run example:simple
npm run example:meta
npm run example:tools
```

## More Examples

The `examples/` directory contains complete, runnable examples:

- **`simple-mind.ts`** - Basic usage with minimal setup
- **`meta-cognition.ts`** - See meta-cognition in action with self-reflection
- **`custom-tools.ts`** - Create and use custom tools for specific tasks
- **`thought-management.ts`** - Control pacing with thought delays
- **`pause-control.ts`** - Pause and resume task execution

Run any example:
```bash
npm run build && node dist/examples/simple-mind.js
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit PRs to the main repository.

## Troubleshooting

### Models not rotating
- Ensure multiple provider API keys are set
- Check that models aren't disabled in state
- Verify model class has multiple options

### High costs
- Adjust metaFrequency to reduce meta-cognition
- Use smaller model classes when appropriate
- Monitor state.usageSummary for cost breakdown

### Slow responses
- Reduce thoughtDelay for faster thinking
- Check network latency to providers
- Consider using faster model classes

## License

MIT