/**
 * Meta-cognition Example
 * 
 * This example demonstrates MECH's meta-cognition capabilities.
 * Shows how to configure meta-cognition frequency and monitor model performance.
 */

import { runMECH, setMetaFrequency, setModelScore, listModelScores } from '../index.js';
import { Agent } from '@just-every/ensemble';

async function main() {
    console.log('🧠 MECH Meta-cognition Example\n');
    
    // Configure meta-cognition to trigger every 5 LLM requests
    setMetaFrequency('5');
    console.log('Meta-cognition frequency set to every 5 LLM requests\n');
    
    // Set some model scores to influence selection
    setModelScore('gpt-4', '85');
    setModelScore('claude-3-5-sonnet-20241022', '90');
    setModelScore('gpt-4o-mini', '60');
    
    console.log('Model scores:');
    console.log(listModelScores());
    console.log();
    
    // Create agent
    const agent = new Agent({
        name: 'MetaBot',
        instructions: 'You are an assistant that demonstrates meta-cognition capabilities. Work through complex reasoning tasks step by step.',
        modelClass: 'reasoning'
    });
    
    const task = 'Solve this step by step: If a train travels 120 km in 2 hours, and then 180 km in the next 3 hours, what is the average speed for the entire journey?';
    
    try {
        console.log('Starting MECH with meta-cognition...\n');
        
        let llmRequestCount = 0;
        
        for await (const event of runMECH(agent, task)) {
            // Track LLM requests to show when meta-cognition triggers
            if (event.type === 'response_start') {
                llmRequestCount++;
                console.log(`\n[Request #${llmRequestCount}] Starting LLM request...`);
            }
            
            // Show message content
            if (event.type === 'message_delta' && 'content' in event) {
                process.stdout.write(event.content);
            }
            
            // Handle completion
            if (event.type === 'tool_done' && 'tool_call' in event) {
                const toolEvent = event as any;
                if (toolEvent.tool_call?.function?.name === 'task_complete') {
                    console.log('\n\n✅ Task completed!');
                    console.log(`Result: ${toolEvent.result?.output}`);
                    break;
                }
            }
        }
        
        console.log('\n📊 Final model scores:');
        console.log(listModelScores());
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}