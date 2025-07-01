/**
 * Live Metamemory Example
 * 
 * This example runs a real conversation through the metamemory system
 * showing actual thread detection and compaction.
 */

import { Agent } from '@just-every/ensemble';
import { 
    runTask, 
    getCompactedHistory,
    configureMetamemory,
    setMetamemoryEnabled,
    addMessageToTask,
    type TaskEvent
} from '../dist/index.js';

async function runLiveExample() {
    console.log('=== Live Metamemory Example ===\n');
    console.log('This example will run a short conversation and show how metamemory tracks it.\n');
    
    // Configure metamemory for quick processing
    configureMetamemory({
        windowSize: 6,           // Small window for demo
        processInterval: 2,      // Process every 2 messages
        threadInactivityTimeout: 10000, // 10 seconds
        compactionThresholds: {
            core: 100,
            active: 70,
            complete: 50,
            ephemeral: 10
        }
    });
    
    // Enable metamemory
    setMetamemoryEnabled(true);
    
    // Create an agent
    const agent = new Agent({
        name: 'LiveDemoAgent',
        modelClass: 'mini',  // Using a faster model for demo
        instructions: `You are a helpful assistant. Keep your responses concise.
        When the user says "done", use the task_complete tool with a summary of what was discussed.`
    });
    
    console.log('Starting conversation...\n');
    console.log('USER: Can you explain what a binary tree is in one paragraph? Then I\'d like a Python example. When I say "done", please complete the task.\n');
    
    let finalState: TaskEvent['finalState'] | undefined;
    
    const task = runTask(agent, 
        `Can you explain what a binary tree is in one paragraph? Then I'd like a Python example. When I say "done", please complete the task.`,
        { metamemoryEnabled: true }
    );
    
    let responseCount = 0;
    
    for await (const event of task) {
        if (event.type === 'content') {
            process.stdout.write(event.content);
        } else if (event.type === 'response_output') {
            responseCount++;
            
            // After first response, ask for the example
            if (responseCount === 1) {
                console.log('\n\nUSER: Great! Now show me the Python example.\n');
                
                addMessageToTask(task, {
                    type: 'message',
                    role: 'user',
                    content: 'Great! Now show me the Python example.'
                });
            }
            // After second response, say done
            else if (responseCount === 2) {
                console.log('\n\nUSER: Done.\n');
                
                addMessageToTask(task, {
                    type: 'message',
                    role: 'user',
                    content: 'Done.'
                });
            }
        } else if (event.type === 'task_complete') {
            finalState = event.finalState;
            console.log('\n\n=== Task Completed ===\n');
        }
    }
    
    // Analyze what metamemory captured
    if (finalState?.metamemoryState) {
        console.log('\n=== Metamemory Analysis ===\n');
        
        const state = finalState.metamemoryState;
        console.log(`Messages tracked: ${state.metamemory.size}`);
        console.log(`Threads identified: ${state.threads.size}`);
        
        // Show threads
        console.log('\nThreads detected:');
        for (const [id, thread] of state.threads) {
            console.log(`- ${thread.name} (${thread.messages.length} messages, class: ${thread.class})`);
        }
        
        // Compact the history
        console.log('\n\n=== Compacting History ===\n');
        const compacted = await getCompactedHistory(finalState);
        
        if (compacted) {
            console.log(`Compacted ${compacted.metadata.originalCount} messages to ${compacted.metadata.compactedCount}`);
            console.log(`Space saved: ${Math.round((1 - compacted.metadata.compactedCount / compacted.metadata.originalCount) * 100)}%`);
            
            console.log('\nCompacted messages:');
            compacted.messages.forEach((msg, i) => {
                const preview = msg.content.length > 100 
                    ? msg.content.substring(0, 100) + '...' 
                    : msg.content;
                console.log(`${i + 1}. ${msg.role}: ${preview}`);
            });
        }
    }
}

// Run the example
console.log('Note: This example uses real API calls to demonstrate metamemory.\n');

runLiveExample().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});