/**
 * Thought Management Example
 * 
 * This example demonstrates Mind's thought delay and interruption capabilities.
 * Shows how to configure timing between agent thoughts.
 */

import { mindTask, setThoughtDelay, getThoughtDelay } from '../index.js';
import { Agent } from '@just-every/ensemble';

async function main() {
    console.log('⏱️  Mind Thought Management Example\n');
    
    // Configure thought delay (2 seconds between thoughts)
    setThoughtDelay('2');
    console.log(`Thought delay set to: ${getThoughtDelay()} seconds\n`);
    
    // Create agent
    const agent = new Agent({
        name: 'ThoughtfulBot',
        instructions: 'You are a thoughtful assistant that takes time to consider your responses carefully. Break down complex problems into steps.',
        modelClass: 'reasoning'
    });
    
    const task = 'Explain the concept of recursion in programming with examples, including both the benefits and potential pitfalls.';
    
    try {
        console.log('Starting Mind with thought delays...\n');
        console.log('Note: You will see pauses between agent thoughts due to the configured delay.\n');
        
        let thoughtCount = 0;
        let startTime = Date.now();
        
        for await (const event of mindTask(agent, task)) {
            // Track when new thoughts begin
            if (event.type === 'response_start') {
                thoughtCount++;
                if (thoughtCount > 1) {
                    console.log(`\n⏸️  [Thought delay of ${getThoughtDelay()}s completed]`);
                }
                console.log(`\n💭 Starting thought #${thoughtCount}...`);
            }
            
            // Show message content
            if (event.type === 'message_delta' && 'content' in event) {
                process.stdout.write(event.content);
            }
            
            // Handle completion
            if (event.type === 'tool_done' && 'tool_call' in event) {
                const toolEvent = event as any;
                if (toolEvent.tool_call?.function?.name === 'task_complete') {
                    const duration = (Date.now() - startTime) / 1000;
                    console.log('\n\n✅ Task completed!');
                    console.log(`Total thoughts: ${thoughtCount}`);
                    console.log(`Total time: ${duration.toFixed(2)}s`);
                    console.log(`Result: ${toolEvent.result?.output}`);
                    break;
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}