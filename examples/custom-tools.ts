/**
 * Custom Tools Example
 * 
 * This example shows how to create and use custom tools with MECH
 * using ensemble v0.1.27's tool builder API.
 */

import { runMECH } from '../simple.js';
import { tool } from '@just-every/ensemble';
import type { RunMechOptions } from '../types.js';

// Create custom tools using the builder pattern
const calculateTool = tool('calculate')
    .description('Perform mathematical calculations')
    .string('expression', 'Mathematical expression to evaluate', true)
    .implement(async (args) => {
        const { expression } = args;
        try {
            // In production, use a safe math parser
            const result = eval(expression);
            return `Result: ${expression} = ${result}`;
        } catch (error) {
            return `Error: Invalid expression "${expression}"`;
        }
    })
    .build();

const searchTool = tool('search_knowledge')
    .description('Search internal knowledge base')
    .string('query', 'Search query', true)
    .number('limit', 'Maximum results to return', false)
    .implement(async (args) => {
        const { query, limit = 5 } = args;
        // Simulate knowledge base search
        const results = [
            'MECH uses meta-cognition for self-improvement',
            'Model rotation optimizes performance across tasks',
            'Thought delays improve reasoning quality',
            'ensemble handles all LLM communication',
            'Cost tracking helps monitor expenses'
        ].filter(item => 
            item.toLowerCase().includes(query.toLowerCase())
        ).slice(0, limit);
        
        return results.length > 0 
            ? `Found ${results.length} results:\n${results.map((r, i) => `${i+1}. ${r}`).join('\n')}`
            : `No results found for "${query}"`;
    })
    .build();

const dataAnalysisTool = tool('analyze_data')
    .description('Analyze data and provide insights')
    .category('analysis')
    .constraints({ priority: 80 })
    .array('data', 'number', 'Array of numbers to analyze', true)
    .implement(async (args) => {
        const { data } = args;
        const sum = data.reduce((a, b) => a + b, 0);
        const avg = sum / data.length;
        const max = Math.max(...data);
        const min = Math.min(...data);
        
        return `Data Analysis:
- Count: ${data.length}
- Sum: ${sum}
- Average: ${avg.toFixed(2)}
- Max: ${max}
- Min: ${min}`;
    })
    .build();

async function main() {
    console.log('🔧 Custom Tools MECH Example\n');
    
    const options: RunMechOptions = {
        agent: {
            name: 'ToolBot',
            modelClass: 'reasoning',
            instructions: 'You are a helpful assistant with access to calculation, search, and data analysis tools.',
            tools: [calculateTool, searchTool, dataAnalysisTool]
        },
        task: `Please help me with the following tasks:
1. Calculate the compound interest on $10,000 at 5% for 3 years
2. Search for information about MECH meta-cognition
3. Analyze this dataset: [15, 22, 18, 25, 30, 19, 21]`,
        onStatus: (status) => {
            console.log(`📊 Status: ${status.type}`);
            if (status.type === 'tool_use' && status.tool_name) {
                console.log(`   🔧 Using tool: ${status.tool_name}`);
            }
        }
    };
    
    try {
        console.log('Starting MECH with custom tools...\n');
        
        const result = await runMECH(options);
        
        console.log('\n✅ MECH Result:');
        console.log('-'.repeat(50));
        console.log(`Status: ${result.status}`);
        console.log(`Duration: ${result.durationSec}s`);
        console.log(`Cost: $${result.totalCost.toFixed(4)}`);
        
        if (result.mechOutcome?.result) {
            console.log(`\n📌 Final Result:\n${result.mechOutcome.result}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run the example
main().catch(console.error);