/**
 * Full Metamemory Demonstration
 * 
 * This example shows a complete conversation with multiple topics
 * and demonstrates how metamemory tracks, categorizes, and compacts them.
 */

import { Agent } from '@just-every/ensemble';
import { 
    runTask, 
    getCompactedHistory,
    configureMetamemory,
    setMetamemoryEnabled,
    addMessageToTask,
    type TaskEvent
} from '../index.js';

async function demonstrateMetamemory() {
    console.log('=== Full Metamemory Demonstration ===\n');
    
    // Configure metamemory with specific settings
    configureMetamemory({
        windowSize: 10,          // Analyze last 10 messages
        processInterval: 3,      // Process every 3 messages
        threadInactivityTimeout: 30000, // 30 seconds for demo
        compactionThresholds: {
            core: 100,      // Always preserve
            active: 80,     // Preserve if score >= 80
            complete: 60,   // Summarize if score < 60
            ephemeral: 20   // Almost always summarize
        }
    });
    
    // Enable metamemory
    setMetamemoryEnabled(true);
    
    // Create an agent with access to task completion tools
    const agent = new Agent({
        name: 'MetamemoryDemoAgent',
        modelClass: 'standard',
        instructions: `You are a helpful assistant engaged in a multi-topic conversation. 
        Help the user with their requests. When a topic is clearly finished, acknowledge it.
        Only use task_complete when the user explicitly says they are done with all topics.`
    });
    
    // Start the conversation with multiple topics
    console.log('Starting multi-topic conversation...\n');
    
    let finalState: TaskEvent['finalState'] | undefined;
    
    const task = runTask(agent, `Hi! I'd like to have a conversation about several topics today:

1. First, can you briefly explain what recursion is in programming?
2. After that, I'd like some healthy breakfast ideas.
3. Finally, I need help planning a weekend trip to Paris.

Let's start with recursion.`, {
        metamemoryEnabled: true
    });
    
    let messageCount = 0;
    
    // Process the task
    for await (const event of task) {
        if (event.type === 'content') {
            process.stdout.write(event.content);
        } else if (event.type === 'response_output') {
            messageCount++;
            console.log(`\n\n[Message ${messageCount} processed by metamemory]\n`);
            
            // Simulate user responses at key points
            if (messageCount === 1) {
                // After recursion explanation
                console.log("\n--- USER: Great explanation! Now let's move on to breakfast ideas. ---\n");
                addMessageToTask(task, {
                    type: 'message',
                    role: 'user',
                    content: "Great explanation! Now let's move on to breakfast ideas. I'm looking for something healthy and quick to prepare."
                });
            } else if (messageCount === 3) {
                // After breakfast ideas
                console.log("\n--- USER: Those breakfast ideas sound delicious! Now about Paris... ---\n");
                addMessageToTask(task, {
                    type: 'message',
                    role: 'user',
                    content: "Those breakfast ideas sound delicious! Now let's plan that Paris trip. I have 3 days and I'm interested in art and food."
                });
            } else if (messageCount === 5) {
                // After Paris suggestions
                console.log("\n--- USER: Perfect! That covers everything I needed. ---\n");
                addMessageToTask(task, {
                    type: 'message',
                    role: 'user',
                    content: "Perfect! That covers everything I needed. Thank you for your help with all three topics. I'm done for now."
                });
            }
        } else if (event.type === 'task_complete') {
            finalState = event.finalState;
            console.log('\n\n=== Task Completed ===');
            console.log('Result:', event.result);
        } else if (event.type === 'task_fatal_error') {
            console.error('\nTask failed:', event.result);
            finalState = event.finalState;
        }
    }
    
    // Analyze metamemory state
    if (finalState?.metamemoryEnabled && finalState.metamemoryState) {
        console.log('\n\n=== Metamemory Analysis ===\n');
        
        const state = finalState.metamemoryState;
        console.log(`Total messages tracked: ${state.metamemory.size}`);
        console.log(`Threads identified: ${state.threads.size}`);
        
        // Show thread details
        console.log('\n--- Thread Details ---');
        for (const [threadId, thread] of state.threads) {
            console.log(`\nThread: ${thread.name}`);
            console.log(`  ID: ${threadId}`);
            console.log(`  Class: ${thread.class}`);
            console.log(`  Status: ${thread.status}`);
            console.log(`  Messages: ${thread.messages.length}`);
            if (thread.summary) {
                console.log(`  Summary: ${thread.summary}`);
            }
        }
        
        // Get compacted history
        console.log('\n\n=== Compacting Conversation History ===\n');
        
        const compactionResult = await getCompactedHistory(finalState, {
            aggressiveMode: false,
            targetTokenCount: 500  // Aim for a compact representation
        });
        
        if (compactionResult) {
            console.log(`Original messages: ${compactionResult.metadata.originalCount}`);
            console.log(`Compacted messages: ${compactionResult.metadata.compactedCount}`);
            console.log(`Reduction: ${Math.round((1 - compactionResult.metadata.compactedCount / compactionResult.metadata.originalCount) * 100)}%`);
            console.log(`\nThreads preserved: ${compactionResult.metadata.threadsPreserved.join(', ') || 'None'}`);
            console.log(`Threads summarized: ${compactionResult.metadata.threadsSummarized.join(', ') || 'None'}`);
            
            console.log('\n--- Compacted History ---\n');
            compactionResult.messages.forEach((msg, idx) => {
                console.log(`[${idx + 1}] ${msg.role.toUpperCase()}${msg.isCompacted ? ' (COMPACTED)' : ''}:`);
                console.log(`    ${msg.content}\n`);
            });
        }
        
        // Demonstrate resuming with compacted history
        console.log('\n\n=== Resuming with Compacted History ===\n');
        console.log('Now asking the agent to summarize what we discussed...\n');
        
        const resumedTask = runTask(agent, 'Can you briefly summarize the three topics we just discussed?', {
            messages: finalState.messages,
            metamemoryEnabled: true,
            metamemoryState: finalState.metamemoryState
        });
        
        for await (const event of resumedTask) {
            if (event.type === 'content') {
                process.stdout.write(event.content);
            } else if (event.type === 'task_complete') {
                console.log('\n\n--- Summary task completed ---');
            }
        }
    } else {
        console.log('\nMetamemory was not enabled or no state was captured.');
    }
}

// Run the demonstration
console.log('Starting metamemory demonstration...\n');
console.log('This will show how conversations are tracked, categorized, and compacted.\n');

demonstrateMetamemory().catch(error => {
    console.error('Error in demonstration:', error);
    process.exit(1);
});