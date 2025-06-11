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
  modelClass: "reasoning" 
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

## Usage

### Basic Usage

```typescript
// Simple task execution
const stream = runTask(agent, "Your task description here");
```

### With Custom Tools

```typescript
const agent = new Agent({
  modelClass: "code",
  tools: [{
    definition: {
      type: 'function',
      function: {
        name: 'search_codebase',
        description: 'Search for code patterns',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string' }
          }
        }
      }
    },
    function: async (pattern) => {
      // Your implementation
      return searchResults;
    }
  }]
});

const stream = runTask(agent, "Find all API endpoints in the codebase");
```

### Model Classes

| Class | Use Cases | Example Models |
|-------|-----------|----------------|
| `reasoning` | Complex logic, multi-step problems | o1, claude-3-opus |
| `code` | Code generation, review, debugging | gpt-4, claude-3-sonnet |
| `standard` | General tasks, writing, Q&A | gpt-3.5, claude-3-haiku |

### Advanced Configuration

```typescript
import { runTask, MindState } from "@just-every/task";

// Initialize with custom state
const state = new MindState();
state.metaFrequency = 10; // Meta-cognition every 10 requests
state.thoughtDelay = 2000; // 2 second delay between thoughts

const stream = runTask(agent, "Complex multi-step task", state);
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

## Examples

See the `examples/` directory for complete examples:

- `simple-mind.ts` - Basic usage
- `meta-cognition.ts` - Meta-cognition in action
- `custom-tools.ts` - Using custom tools
- `thought-management.ts` - Controlling thought delays

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