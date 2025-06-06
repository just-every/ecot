# @just-every/mech

[![npm version](https://badge.fury.io/js/@just-every%2Fmech.svg)](https://www.npmjs.com/package/@just-every/mech)
[![GitHub Actions](https://github.com/just-every/MECH/workflows/Release/badge.svg)](https://github.com/just-every/MECH/actions)

**MECH** - The simplest way to add meta-cognition and model rotation to your LLM agents.

## 🚀 What is MECH?

MECH is a minimal orchestration layer that adds advanced capabilities to @just-every/ensemble:

- **🤖 Automatic Model Rotation**: Intelligent model selection based on performance
- **🧠 Meta-cognition**: Self-reflection and strategy adjustment  
- **🔄 Continuous Loop**: Multi-turn conversations until task completion
- **🛠️ Tool Management**: Automatic tool integration and execution
- **💰 Cost Tracking**: Built-in monitoring across all operations
- **📊 State Management**: Performance tracking and model scoring

## 📦 Installation

```bash
npm install @just-every/mech
```

**Note:** MECH requires `@just-every/ensemble` v0.2.11 or later.

## 🔑 Setup

MECH automatically handles all LLM communication. Just set your API keys:

```bash
# Set one or more API keys (environment variables)
export OPENAI_API_KEY="your-openai-key"
export ANTHROPIC_API_KEY="your-anthropic-key" 
export GOOGLE_API_KEY="your-google-key"
```

That's it! MECH will automatically route to the appropriate provider.

## 🧠 Model Classes

MECH's **model classes** automatically select the best models for different types of tasks:

| Model Class | Best For | Example Use Cases |
|-------------|----------|-------------------|
| `reasoning` | Complex logic, math, analysis | Multi-step problems, strategic planning, research analysis |
| `code` | Programming tasks | Code review, debugging, writing functions, refactoring |
| `standard` | General tasks | Writing, summarization, Q&A, basic analysis |
| `metacognition` | Self-reflection | Performance analysis, strategy adjustment, learning |

**Recommended:** Always use `modelClass` instead of specifying exact models. MECH will automatically rotate through the best models and learn which ones work best for your specific use cases.

## ⚡ Quick Start

MECH has one simple function that does everything automatically!

```typescript
import { runMECH } from '@just-every/mech';
import { Agent } from '@just-every/ensemble';

// Set API keys via environment variables:
// OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY

// Create an agent
const agent = new Agent({
    name: 'CodeReviewer',
    modelClass: 'reasoning'
});

// Run MECH - everything is automatic!
const result = await runMECH(agent, 'Review this function: function add(a, b) { return a + b; }');

console.log(result.status);        // 'complete' or 'fatal_error'
console.log(result.mechOutcome);   // The agent's response
```

### 🧠 Different Model Classes

```typescript
import { runMECH } from '@just-every/mech';
import { Agent } from '@just-every/ensemble';

// For complex reasoning
const reasoningAgent = new Agent({ modelClass: 'reasoning' });
await runMECH(reasoningAgent, 'Solve this multi-step logic problem...');

// For code tasks
const codeAgent = new Agent({ modelClass: 'code' });
await runMECH(codeAgent, 'Write a React component for authentication');

// For general tasks  
const generalAgent = new Agent({ modelClass: 'standard' });
await runMECH(generalAgent, 'Summarize this article in 3 bullet points');

// For meta-analysis (used internally by MECH)
const metaAgent = new Agent({ modelClass: 'metacognition' });
await runMECH(metaAgent, 'Analyze agent performance and suggest improvements');
```

### 🎛️ With Specific Models (Alternative)

```typescript
const agent = new Agent({ 
    model: 'claude-3-5-sonnet-20241022'  // Override automatic selection
});
await runMECH(agent, 'Explain quantum computing in simple terms');
```

### 🚀 With Status Monitoring

```typescript
const result = await runMECH({
    agent: { 
        name: 'Assistant',      // Optional: defaults to "Agent"
        modelClass: 'reasoning' 
    },
    task: 'Explain quantum computing in simple terms',
    onStatus: (status) => {
        console.log('📊 Status:', status.type, status);
    },
    onHistory: (item) => {
        console.log('💬 New message:', item.role, item.content);
    }
});
```

## 🎯 Real-World Examples

### 🔍 Code Analysis Agent

```typescript
import { runMECH } from '@just-every/mech';

const result = await runMECH({
    agent: { 
        name: 'CodeAnalyzer',
        modelClass: 'code',  // Optimized for code tasks
        instructions: 'You are an expert code reviewer. Analyze code for bugs, performance issues, and best practices.'
    },
    task: `Please review this TypeScript function:

function processData(data: any[]): any {
    let result = [];
    for (let i = 0; i < data.length; i++) {
        if (data[i].active) {
            result.push(data[i]);
        }
    }
    return result;
}`,
    onStatus: (status) => console.log('📊 Status:', status.type),
    onHistory: (item) => console.log('💬 New message:', item.role)
});

console.log('✅ Analysis complete:', result.mechOutcome?.result);
```

### 🧠 Multi-Turn Problem Solving

```typescript
const result = await runMECH({
    agent: { 
        name: 'MathTutor',
        modelClass: 'reasoning',  // Best for complex math problems
        instructions: 'You are a patient math tutor. Break down complex problems step by step.'
    },
    task: 'Help me solve this calculus problem: Find the derivative of f(x) = x²e^x'
    // loop defaults to true for multi-turn conversation
});
```

### 📚 Memory-Enhanced Research Assistant

```typescript
import { runMECH } from '@just-every/mech';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const result = await runMECH({
    agent: { 
        name: 'ResearchAssistant',
        modelClass: 'standard',  // Good for research and analysis
        instructions: 'You are a research assistant with access to past conversations and knowledge.'
    },
    task: 'Research the latest developments in quantum computing and compare with our previous discussion',
    
    // Memory features (optional) - embedding is handled automatically by @just-every/ensemble
    
    lookupMemories: async (embedding) => {
        // Search your vector database
        const results = await vectorDB.query({
            vector: embedding,
            topK: 5,
            includeMetadata: true
        });
        return results.matches.map(match => ({
            text: match.metadata.text,
            metadata: { score: match.score, ...match.metadata }
        }));
    },
    
    saveMemory: async (taskId, memories) => {
        // Save memories to your database
        for (const memory of memories) {
            await db.memories.create({
                taskId,
                text: memory.text,
                metadata: memory.metadata,
                timestamp: new Date()
            });
        }
    }
});
```

## 🔧 Custom Tools

### Creating Custom Tools with ensemble's Tool Builder

MECH now uses ensemble v0.1.27's `tool()` builder for creating custom tools:

```typescript
import { runMECH } from '@just-every/mech';
import { tool } from '@just-every/ensemble';

// Create a custom tool using the builder pattern
const weatherTool = tool('get_weather')
    .description('Get current weather for a location')
    .string('location', 'City name or coordinates', true)
    .enum('units', ['celsius', 'fahrenheit'], 'Temperature units', false)
    .implement(async (args) => {
        // Your implementation here
        const { location, units = 'celsius' } = args;
        // Fetch weather data...
        return `Weather in ${location}: 22°${units === 'celsius' ? 'C' : 'F'} and sunny`;
    })
    .build();

// Use the tool with MECH
const result = await runMECH({
    agent: {
        name: 'WeatherBot',
        modelClass: 'standard',
        tools: [weatherTool]  // Add your custom tools here
    },
    task: 'What\'s the weather like in Paris?'
});
```

### Tool Categories and Priorities

```typescript
const criticalTool = tool('emergency_shutdown')
    .description('Emergency system shutdown')
    .category('control')        // Tool category
    .constraints({ 
        priority: 100,          // Higher priority = executed first
        maxExecutions: 1        // Limit executions per session
    })
    .hasSideEffects()          // Mark as having side effects
    .implement(async () => {
        // Implementation
        return 'System shutdown initiated';
    })
    .build();
```

## 🛠️ Advanced Configuration

### 🎛️ Fine-tune MECH Behavior

```typescript
import { runMECH, setMetaFrequency, setThoughtDelay, setModelScore } from '@just-every/mech';

// Configure meta-cognition frequency
setMetaFrequency('10'); // Analyze performance every 10 LLM requests

// Set thought delays for better reasoning
setThoughtDelay('4'); // 4-second pause between thoughts

// Adjust model performance scores
setModelScore('gpt-4-turbo', '95');     // High score = used more often
setModelScore('claude-3-sonnet', '85'); // Lower score = used less often

const result = await runMECH({
    agent: { 
        modelClass: 'reasoning',  // Let MECH optimize model selection
        instructions: 'Think step by step and use multiple perspectives'
    },
    task: 'Complex reasoning task requiring multiple models'
});
```

### 📊 Cost Monitoring

```typescript
import { runMECH, getTotalCost, resetCostTracker } from '@just-every/mech';

// Reset cost tracking for new session
resetCostTracker();

// Run multiple MECH operations
await runMECH({ /* options */ });
await runMECH({ /* options */ });
await runMECH({ /* options */ });

// Check total costs
const totalCost = getTotalCost();
console.log(`💰 Total session cost: $${totalCost.toFixed(4)}`);

// Set up cost alerts
if (totalCost > 5.0) {
    console.warn('⚠️ High cost detected! Consider optimizing.');
}
```

## 🎮 Interactive Examples

Run these examples to see MECH in action:

```bash
# Build the project
npm run build

# Try different examples
node dist/examples/simple-mech.js          # Basic usage
node dist/examples/custom-tools.js         # Custom tools with tool builder
node dist/examples/mech-with-memory.js     # Memory features  
node dist/examples/meta-cognition.js       # Self-reflection
node dist/examples/thought-management.js   # Thought pacing
```

## 🔧 Integration Patterns

### 🌐 Express.js API Server

```typescript
import express from 'express';
import { runMECH } from '@just-every/mech';

const app = express();
app.use(express.json());

app.post('/api/analyze', async (req, res) => {
    try {
        const { task, agentType = 'Analyst', model = 'gpt-4' } = req.body;
        
        const result = await runMECH({
            agent: { 
                name: agentType,
                modelClass: req.body.modelClass || 'standard'
            },
            task: task
        });
        
        res.json({
            success: result.status === 'complete',
            data: result.mechOutcome?.result,
            cost: result.totalCost,
            duration: result.durationSec
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### ⚛️ React Component

```typescript
import React, { useState } from 'react';
import { runMECH } from '@just-every/mech';

export function AIAssistant() {
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);

    const handleQuery = async (query: string) => {
        setLoading(true);
        try {
            const result = await runMECH({
                agent: { 
                    name: 'Assistant',
                    modelClass: 'standard'  // Choose appropriate class
                },
                task: query,
                onStatus: (status) => {
                    console.log('Status:', status.type);
                }
            });
            setResponse(result.mechOutcome?.result || 'No response');
        } catch (error) {
            setResponse('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <button onClick={() => handleQuery('Hello!')}>
                {loading ? 'Thinking...' : 'Ask AI'}
            </button>
            <div>{response}</div>
        </div>
    );
}
```


## 📚 Complete API Reference

### Primary Function

#### `runMECH(options)`

The main function for running MECH with any configuration:

```typescript
interface RunMechOptions {
    // Required
    agent: SimpleAgent;           // Agent configuration
    task: string;                 // Task description
    
    // Optional Core
    loop?: boolean;               // Enable multi-turn conversation (default: true)
    onHistory?: HistoryCallback;  // Called when history items are added
    onStatus?: StatusCallback;    // Called for status updates
    
    // Optional Memory Features
    lookupMemories?: LookupFn;    // Vector similarity search (embedding handled automatically)
    saveMemory?: SaveMemoryFn;    // Memory persistence
}

interface SimpleAgent {
    name?: string;                // Optional: defaults to "Agent"
    modelClass?: string;          // Recommended: "reasoning", "standard", "code", "metacognition"
    model?: string;               // Alternative: specific model override
    instructions?: string;        // System prompt for the agent
}
```

**Example Response:**
```typescript
{
    status: 'complete',           // 'complete' | 'fatal_error'
    mechOutcome: {
        status: 'complete',
        result: 'Task completed successfully',
        event: { /* ensemble event data */ }
    },
    history: [/* conversation history */],
    durationSec: 12.5,
    totalCost: 0.0043
}
```

### State Management Functions

```typescript
// Meta-cognition
setMetaFrequency('5' | '10' | '20' | '40')  // How often to self-reflect
getMetaFrequency(): string                   // Current frequency

// Model scoring (0-100, higher = used more often)
setModelScore('gpt-4', '90')                // Set model performance score
getModelScore('gpt-4'): number              // Get current score
disableModel('claude-2')                    // Temporarily disable model
enableModel('claude-2')                     // Re-enable disabled model

// Thought management
setThoughtDelay('0' | '2' | '4' | '8' | '16' | '32' | '64' | '128')  // Seconds
getThoughtDelay(): string                   // Current delay setting
```

### Utility Functions

```typescript
// Cost tracking
getTotalCost(): number          // Total cost across all MECH runs
resetCostTracker(): void        // Reset cost counter

// State inspection  
mechState.llmRequestCount       // Number of LLM requests made
mechState.disabledModels        // Set of disabled model IDs
mechState.modelScores           // Current model performance scores
```

## 🔍 How MECH Works

### 🔄 The MECH Loop

1. **Model Selection**: Chooses optimal model based on performance scores and task type
2. **Task Execution**: Runs your LLM function with enhanced context and tools
3. **Meta-cognition**: Periodically analyzes performance and adjusts strategy
4. **Memory Integration**: Optionally stores and retrieves relevant context
5. **Cost Tracking**: Monitors expenses across all operations

### 🧠 Meta-cognition in Action

MECH can automatically:
- Adjust model scores based on success/failure rates
- Change meta-cognition frequency for better or worse performing agents
- Disable underperforming models temporarily
- Inject strategic thoughts to guide better reasoning

### 🎯 Model Rotation Strategy

Models are selected using weighted random selection:
- Higher scored models (90-100) are chosen more frequently
- Lower scored models (10-30) still participate but less often
- Disabled models (score 0) are excluded entirely
- Diversity is maintained by avoiding consecutive model reuse

## 🚨 Troubleshooting

### Common Issues

**❌ "Model not available" errors**
```typescript
// Solution: Check model availability and adjust scores
import { listDisabledModels, enableModel } from '@just-every/mech';

console.log(listDisabledModels());
enableModel('your-model-id');
```

**❌ High costs**
```typescript
// Solution: Monitor and control costs
import { getTotalCost, resetCostTracker } from '@just-every/mech';

const cost = getTotalCost();
if (cost > 1.0) {
    console.warn('Cost limit reached');
    resetCostTracker(); // Start fresh
}
```

**❌ Memory not working**
```typescript
// Solution: Ensure embed function is provided
const result = await runMECH({
    agent: { name: 'Agent' },
    task: 'Remember this',
    // Memory features are enabled when lookupMemories and saveMemory are provided
    // Embedding is handled automatically by @just-every/ensemble
});
```

### Performance Tips

1. **Optimize Model Scores**: Regularly review and adjust based on performance
2. **Use Appropriate Delays**: Balance reasoning quality with response time
3. **Monitor Memory Usage**: Implement efficient vector storage and retrieval
4. **Batch Operations**: Group related tasks to minimize overhead

## 🤝 Migration Guide

### From v0.1.5 and earlier

The API has been dramatically simplified! No more `runAgent` function required:

```typescript
// Before (v0.1.5)
await runMECH({ 
    agent: { name: 'Agent' },
    task: 'Do something',
    runAgent: async (agent, input, history) => {
        // Complex LLM integration code
        return { response: await yourLLM.complete(input) };
    }
});

// After (v0.1.6+) - Much simpler!
await runMECH({ 
    agent: { modelClass: 'reasoning' },  // Recommended approach
    task: 'Do something'
    // MECH handles LLM communication automatically!
});
```

**Breaking Changes:**
- ❌ `runAgent` function is no longer needed (or supported)
- ✅ Just set environment variables: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`  
- ✅ Use `modelClass` for automatic model selection (recommended)
- ✅ `name` is now optional (defaults to "Agent")

## 📁 Project Structure

```
@just-every/mech/
├── examples/           # Practical examples and demos
├── test/              # Comprehensive test suite (118 tests)
├── utils/             # Internal utilities and helpers
├── index.ts           # Main exports and API
├── simple.ts          # Simple API implementation  
├── types.ts           # TypeScript definitions
├── mech_state.ts      # State management
├── mech_tools.ts      # Core MECH functionality
├── thought_utils.ts   # Thought delay management
└── meta_cognition.ts  # Meta-cognition implementation
```

## 🧪 Testing

```bash
# Run all tests (118 tests)
npm test

# Run specific test suites
npm test mech_state.test.ts      # State management
npm test integration.test.ts     # Integration tests  
npm test performance.test.ts     # Performance tests

# Build and test examples
npm run build
npm test && npm run build        # Pre-commit workflow
```

## 📄 License

MIT - feel free to use in your projects!

---

**Ready to supercharge your LLM applications?** Install MECH today and experience intelligent model orchestration with meta-cognition! 🚀

```bash
npm install @just-every/mech
```