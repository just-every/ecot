/**
 * Simple Metamemory Example
 * 
 * This example shows how to enable metamemory for a task
 * to automatically track and compact conversation history.
 */

import { Agent } from '@just-every/ensemble';
import { runTask, setMetamemoryEnabled } from '../index.js';

async function main() {
    console.log('=== Simple Metamemory Example ===\n');
    
    // Enable metamemory globally (optional - can also be done per-task)
    setMetamemoryEnabled(true);
    
    // Create an agent
    const agent = new Agent({
        name: 'ConversationAgent',
        modelClass: 'standard',
        instructions: 'You are a helpful assistant. When the user completes a topic, use the task_complete tool to finish.'
    });
    
    // Run a task with metamemory
    console.log('Starting task with metamemory enabled...\n');
    
    for await (const event of runTask(agent, 'Help me understand recursion in programming')) {
        if (event.type === 'content') {
            process.stdout.write(event.content);
        } else if (event.type === 'task_complete') {
            console.log('\n\nTask completed!');
            console.log('Final state includes metamemory:', !!event.finalState.metamemoryState);
            
            // The metamemory state is automatically saved in finalState
            // You can use it to resume conversations or compact history
            if (event.finalState.metamemoryState) {
                const threads = event.finalState.metamemoryState.threads;
                console.log(`Threads tracked: ${threads.size}`);
                console.log(`Messages tracked: ${event.finalState.metamemoryState.metamemory.size}`);
            }
        }
    }
}

main().catch(console.error);