/**
 * 🚀 MECH Basic Examples
 * 
 * Comprehensive examples showing how to use MECH for various real-world scenarios.
 * These examples demonstrate the progression from simple usage to advanced features.
 */

import { runMECH, getTotalCost, resetCostTracker, setModelScore, setMetaFrequency } from '../index.js';

// 🎯 Example 1: Code Review Assistant
async function codeReviewExample() {
    console.log('🔍 === Code Review Assistant ===');
    
    const codeToReview = `
function calculateTotal(items) {
    var total = 0;
    for (var i = 0; i < items.length; i++) {
        total += items[i].price * items[i].quantity;
    }
    return total;
}`;

    const result = await runMECH({
        agent: { 
            name: 'CodeReviewBot',
            instructions: 'You are a senior developer. Review code for bugs, performance, and best practices.'
        },
        task: `Please review this JavaScript function and suggest improvements:\n${codeToReview}`,
        runAgent: async (agent, input, _history) => {
            // Simulate detailed code analysis
            console.log(`🤖 ${agent.name} analyzing code...`);
            
            const review = `
CODE REVIEW ANALYSIS:

Issues Found:
1. Using 'var' instead of 'const/let' (ES6+ best practice)
2. No input validation for 'items' parameter
3. Missing JSDoc documentation
4. No error handling for malformed items

Improved Version:
\`\`\`javascript
/**
 * Calculates the total cost of items
 * @param {Array<{price: number, quantity: number}>} items - Array of items
 * @returns {number} Total cost
 */
function calculateTotal(items) {
    if (!Array.isArray(items)) {
        throw new Error('Items must be an array');
    }
    
    return items.reduce((total, item) => {
        if (typeof item.price !== 'number' || typeof item.quantity !== 'number') {
            throw new Error('Item must have numeric price and quantity');
        }
        return total + (item.price * item.quantity);
    }, 0);
}
\`\`\`

Performance: ✅ Good for small arrays, consider streaming for large datasets
Security: ✅ No apparent security issues
Maintainability: ⚠️ Improved with validation and documentation`;

            return { response: review };
        },
        onStatus: (status) => console.log(`📊 Status: ${status.type}`),
        onHistory: (item) => console.log(`💬 ${item.role}: ${item.content?.substring(0, 50)}...`)
    });
    
    console.log('✅ Review Status:', result.status);
    console.log('📝 Review Result:\n', result.mechOutcome?.result);
    console.log(`⏱️  Duration: ${result.durationSec.toFixed(2)}s`);
    console.log(`💰 Cost: $${result.totalCost.toFixed(4)}`);
}

// 📚 Example 2: Research Assistant with Memory
async function researchAssistantExample() {
    console.log('\n📚 === Research Assistant with Memory ===');
    
    // Simulate a knowledge base
    const knowledgeBase = [
        { topic: 'AI', content: 'Artificial Intelligence has grown rapidly since 2020 with LLMs leading the way.' },
        { topic: 'TypeScript', content: 'TypeScript 5.0 introduced decorators and improved type inference.' },
        { topic: 'React', content: 'React 18 brought concurrent features and automatic batching.' }
    ];
    
    const result = await runMECH({
        agent: { 
            name: 'ResearchBot',
            instructions: 'You are a research assistant with access to a knowledge base. Provide comprehensive, well-sourced answers.'
        },
        task: 'What are the latest developments in TypeScript? Include version history and recent features.',
        runAgent: async (agent, input, history) => {
            console.log(`🔍 ${agent.name} researching: ${input.substring(0, 50)}...`);
            
            // Simulate research process
            const relevantKnowledge = knowledgeBase.filter(item => 
                input.toLowerCase().includes(item.topic.toLowerCase())
            );
            
            let research = `RESEARCH FINDINGS:

Based on my knowledge base search, here's what I found about TypeScript:

${relevantKnowledge.map(item => `• ${item.content}`).join('\n')}

Additional Context:
• TypeScript continues to evolve with Microsoft's backing
• Strong adoption in enterprise and open-source projects
• Excellent tooling ecosystem with VS Code integration
• Regular release cycle with new features every 3-4 months

Recent trends show increasing adoption in:
- Server-side development (Node.js)
- Frontend frameworks (React, Vue, Angular)
- Mobile development (React Native)
- Desktop applications (Electron)`;

            return { response: research };
        },
        
        // Memory integration
        embed: async (text) => {
            // Simulate embedding generation
            console.log(`🧠 Generating embedding for: ${text.substring(0, 30)}...`);
            return Array.from({length: 1536}, () => Math.random());
        },
        
        lookupMemories: async (embedding) => {
            // Simulate vector search
            console.log('🔍 Searching knowledge base...');
            return knowledgeBase.map(item => ({
                text: item.content,
                metadata: { topic: item.topic, relevance: Math.random() }
            }));
        },
        
        saveMemory: async (taskId, memories) => {
            console.log(`💾 Saving ${memories.length} memories for task ${taskId}`);
            memories.forEach(memory => {
                knowledgeBase.push({
                    topic: 'learned',
                    content: memory.text
                });
            });
        }
    });
    
    console.log('✅ Research Status:', result.status);
    console.log('📖 Research Findings:\n', result.mechOutcome?.result);
}

// 🧮 Example 3: Multi-Step Problem Solver
async function problemSolverExample() {
    console.log('\n🧮 === Multi-Step Problem Solver ===');
    
    const result = await runMECH({
        agent: { 
            name: 'MathTutor',
            instructions: 'You are a patient math tutor. Break down complex problems into clear steps.'
        },
        task: 'Solve this optimization problem: A farmer has 100 meters of fencing and wants to create a rectangular pen with maximum area. What dimensions should the pen have?',
        loop: true, // Enable multi-turn reasoning
        runAgent: async (agent, input, history) => {
            console.log(`🧠 ${agent.name} thinking through the problem...`);
            
            // Simulate step-by-step problem solving
            const solution = `
OPTIMIZATION PROBLEM SOLUTION:

Step 1: Define the problem
- Perimeter constraint: 2l + 2w = 100 meters
- Objective: Maximize area A = l × w

Step 2: Express area in terms of one variable
- From perimeter: w = 50 - l
- Area function: A(l) = l(50 - l) = 50l - l²

Step 3: Find the maximum using calculus
- dA/dl = 50 - 2l
- Set derivative to zero: 50 - 2l = 0
- Solve for l: l = 25 meters

Step 4: Find width
- w = 50 - l = 50 - 25 = 25 meters

Step 5: Verify it's a maximum
- d²A/dl² = -2 < 0 ✓ (confirms maximum)

ANSWER: The pen should be 25m × 25m (a square) for maximum area of 625 m².

This makes intuitive sense because among all rectangles with the same perimeter, 
the square has the largest area.`;

            return { response: solution };
        },
        onStatus: (status) => console.log(`🎯 Problem solving: ${status.type}`)
    });
    
    console.log('✅ Solution Status:', result.status);
    console.log('📐 Mathematical Solution:\n', result.mechOutcome?.result);
}

// ⚙️ Example 4: Advanced Configuration & Error Handling
async function advancedConfigExample() {
    console.log('\n⚙️ === Advanced Configuration Example ===');
    
    // Configure MECH behavior
    setMetaFrequency('5'); // Analyze performance every 5 requests
    setModelScore('gpt-4', '95'); // Prefer GPT-4
    setModelScore('claude-3', '85'); // Claude as backup
    
    const result = await runMECH({
        agent: { 
            name: 'ConfiguredAgent',
            model: 'gpt-4', // Specify preferred model
            instructions: 'You are a helpful assistant with advanced configuration.'
        },
        task: 'Explain how MECH\'s configuration system works',
        runAgent: async (agent, input, _history) => {
            console.log(`⚙️ ${agent.name} with model ${agent.model || 'auto'}`);
            
            // Simulate potential error for demonstration
            if (Math.random() < 0.3) {
                throw new Error('Simulated API rate limit exceeded');
            }
            
            const explanation = `
MECH CONFIGURATION SYSTEM:

🎛️ Model Scoring (0-100):
- Higher scores = selected more frequently
- Lower scores = backup options
- Score 0 = disabled model

🧠 Meta-cognition Frequency:
- '5' = analyze every 5 LLM calls
- '10' = analyze every 10 LLM calls
- Higher = less frequent self-reflection

💭 Thought Delays:
- Configurable pacing (0-128 seconds)
- Improves reasoning quality
- Interruptible for efficiency

📊 Cost Tracking:
- Automatic across all operations
- Granular per-request monitoring
- Budget alert capabilities

This configuration allows MECH to adapt to your specific needs and constraints.`;

            return { response: explanation };
        },
        onStatus: (status) => {
            if (status.type === 'error') {
                console.log('🚨 Error detected, MECH will handle gracefully');
            } else {
                console.log(`📊 ${status.type}`);
            }
        }
    });
    
    console.log('✅ Configuration Status:', result.status);
    if (result.status === 'fatal_error') {
        console.log('❌ Error occurred:', result.mechOutcome?.error);
    } else {
        console.log('📖 Configuration Explanation:\n', result.mechOutcome?.result);
    }
}

// 🎮 Example 5: Interactive Session Simulation
async function interactiveSessionExample() {
    console.log('\n🎮 === Interactive Session Simulation ===');
    
    const conversationHistory: string[] = [];
    
    const queries = [
        'Hello, can you help me learn about AI?',
        'What is machine learning?', 
        'How does deep learning differ from traditional ML?',
        'Can you give me a practical example?'
    ];
    
    for (const [index, query] of queries.entries()) {
        console.log(`\n👤 User: ${query}`);
        
        const result = await runMECH({
            agent: { 
                name: 'TutorBot',
                instructions: 'You are a friendly AI tutor. Build on previous conversation context.'
            },
            task: query,
            runAgent: async (_agent, input, history) => {
                // Use conversation history for context
                const context = conversationHistory.length > 0 
                    ? `Previous conversation:\n${conversationHistory.join('\n')}\n\n` 
                    : '';
                
                console.log(`🤖 TutorBot thinking... (turn ${index + 1}/4)`);
                
                // Simulate contextual responses
                let response = '';
                
                if (input.includes('Hello')) {
                    response = "Hello! I'd be delighted to help you learn about AI. It's a fascinating field that's transforming our world. What would you like to know?";
                } else if (input.includes('machine learning')) {
                    response = "Machine Learning is a subset of AI where computers learn patterns from data without being explicitly programmed for each task. Think of it like teaching a computer to recognize cats in photos by showing it thousands of examples.";
                } else if (input.includes('deep learning')) {
                    response = "Great question! Deep Learning uses neural networks with many layers (hence 'deep') to learn complex patterns. Unlike traditional ML which often needs hand-crafted features, deep learning can automatically discover relevant features from raw data.";
                } else if (input.includes('practical example')) {
                    response = "Here's a practical example: Image recognition in smartphones. Traditional ML might need you to manually define features like 'edges' and 'corners'. Deep learning looks at millions of photos and learns these features automatically, achieving much better accuracy.";
                } else {
                    response = "That's an interesting question! Let me think about how to explain that in the context of what we've discussed.";
                }
                
                // Add to conversation history
                conversationHistory.push(`User: ${input}`);
                conversationHistory.push(`TutorBot: ${response}`);
                
                return { response };
            },
            onHistory: (item) => {
                if (item.role === 'assistant') {
                    console.log(`🤖 TutorBot: ${item.content?.substring(0, 80)}...`);
                }
            }
        });
        
        if (result.status === 'complete') {
            console.log(`✅ Response: ${result.mechOutcome?.result}`);
        }
    }
}

// 📊 Run all examples with cost tracking
async function runAllExamples() {
    console.log('🚀 MECH Advanced Examples Starting...\n');
    
    // Reset cost tracking for this session
    resetCostTracker();
    
    try {
        await codeReviewExample();
        await researchAssistantExample();
        await problemSolverExample();
        await advancedConfigExample();
        await interactiveSessionExample();
        
        // Final cost summary
        console.log('\n💰 === Final Cost Summary ===');
        const totalCost = getTotalCost();
        console.log(`Total session cost: $${totalCost.toFixed(6)}`);
        console.log(`Average cost per example: $${(totalCost / 5).toFixed(6)}`);
        
        if (totalCost === 0) {
            console.log('ℹ️  Note: Costs are $0 because examples use simulated LLM responses');
            console.log('🔗 In real usage, integrate with OpenAI, Anthropic, or other LLM providers');
        }
        
        console.log('\n🎉 All examples completed successfully!');
        console.log('📚 Try modifying these examples with your own LLM integrations');
        
    } catch (error) {
        console.error('❌ Error running examples:', error);
        console.log('\n🛠️  This might happen with real LLM APIs due to:');
        console.log('   • Rate limits');
        console.log('   • API key issues'); 
        console.log('   • Network connectivity');
        console.log('   • Model availability');
    }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllExamples();
}