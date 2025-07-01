/**
 * Metamemory Demo
 * 
 * This example demonstrates how to use Task's metamemory system
 * for intelligent conversation history compaction.
 */

import { Agent } from '@just-every/ensemble';
import { 
    runTask, 
    getCompactedHistory,
    setMetamemoryEnabled,
    configureMetamemory,
    type TaskEvent
} from '../index.js';

async function demonstrateMetamemory() {
    console.log('=== Metamemory Demo ===\n');
    
    // Configure metamemory globally
    configureMetamemory({
        windowSize: 10,          // Analyze last 10 messages
        processInterval: 3,      // Process every 3 messages
        threadInactivityTimeout: 60000, // 1 minute
        compactionThresholds: {
            core: 100,
            active: 80,
            complete: 60,
            ephemeral: 20
        }
    });
    
    // Enable metamemory
    setMetamemoryEnabled(true);
    
    // Create an agent
    const agent = new Agent({
        name: 'MetamemoryAgent',
        modelClass: 'standard',
        instructions: 'You are a helpful assistant engaged in a multi-topic conversation. Please help the user with their various requests.'
    });
    
    // Run a task with metamemory enabled
    console.log('Starting conversation with metamemory tracking...\n');
    
    let finalState: TaskEvent['finalState'] | undefined;
    
    // Simulate a conversation with multiple topics
    const task = runTask(agent, `I need help with three things:
1. First, can you explain what recursion is in programming?
2. Then, I'd like to know about healthy breakfast options.
3. Finally, help me plan a weekend trip to Paris.

Let's start with recursion.`, {
        metamemoryEnabled: true
    });
    
    // Process the task
    for await (const event of task) {
        if (event.type === 'content') {
            process.stdout.write(event.content);
        } else if (event.type === 'task_complete') {
            finalState = event.finalState;
            console.log('\n\nTask completed!');
            console.log('Result:', event.result);
        } else if (event.type === 'task_fatal_error') {
            console.error('\nTask failed:', event.result);
            finalState = event.finalState;
        }
    }
    
    // Demonstrate compaction
    if (finalState?.metamemoryEnabled && finalState.metamemoryState) {
        console.log('\n=== Metamemory Analysis ===\n');
        
        // Get compacted history
        const compactionResult = await getCompactedHistory(finalState, {
            preserveThreadIds: [],  // Preserve specific threads if needed
            aggressiveMode: false,  // Use normal compaction
            targetTokenCount: 1000  // Aim for ~1000 tokens
        });
        
        if (compactionResult) {
            console.log(`Original messages: ${compactionResult.metadata.originalCount}`);
            console.log(`Compacted messages: ${compactionResult.metadata.compactedCount}`);
            console.log(`Threads preserved: ${compactionResult.metadata.threadsPreserved.join(', ')}`);
            console.log(`Threads summarized: ${compactionResult.metadata.threadsSummarized.join(', ')}`);
            
            console.log('\n=== Compacted History ===\n');
            compactionResult.messages.forEach((msg, idx) => {
                console.log(`[${idx + 1}] ${msg.role.toUpperCase()}: ${msg.content.substring(0, 100)}...`);
                if (msg.isCompacted) {
                    console.log('   (This is a compacted summary)');
                }
            });
        }
    }
    
    // Resume with compacted history
    console.log('\n=== Resuming with Compacted History ===\n');
    
    if (finalState) {
        // You can resume the conversation with the compacted history
        const resumedTask = runTask(agent, 'Can you summarize what we discussed?', {
            messages: finalState.messages,
            metamemoryEnabled: true,
            metamemoryState: finalState.metamemoryState
        });
        
        for await (const event of resumedTask) {
            if (event.type === 'content') {
                process.stdout.write(event.content);
            } else if (event.type === 'task_complete') {
                console.log('\n\nResumed task completed!');
            }
        }
    }
}

// Example of using metamemory without global configuration
async function demonstrateLocalMetamemory() {
    console.log('\n\n=== Local Metamemory Configuration ===\n');
    
    const agent = new Agent({
        name: 'LocalMetamemoryAgent',
        modelClass: 'standard'
    });
    
    // Use metamemory for just this task
    const task = runTask(agent, 'Tell me about the water cycle.', {
        metamemoryEnabled: true
    });
    
    let finalState: TaskEvent['finalState'] | undefined;
    
    for await (const event of task) {
        if (event.type === 'content') {
            process.stdout.write(event.content);
        } else if (event.type === 'task_complete') {
            finalState = event.finalState;
        }
    }
    
    // Check if metamemory was used
    if (finalState?.metamemoryState) {
        console.log('\n\nMetamemory was active for this task');
        console.log(`Threads created: ${finalState.metamemoryState.threads.size}`);
        console.log(`Messages tracked: ${finalState.metamemoryState.metamemory.size}`);
    }
}

// Run the demonstrations
(async () => {
    try {
        await demonstrateMetamemory();
        await demonstrateLocalMetamemory();
    } catch (error) {
        console.error('Error:', error);
    }
})();