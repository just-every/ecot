/**
 * Working Metamemory Demo
 * This is a JavaScript version that imports from the built distribution
 */

import { Agent } from '@just-every/ensemble';
import { 
    runTask, 
    getCompactedHistory,
    configureMetamemory,
    setMetamemoryEnabled,
    addMessageToTask
} from '../dist/index.js';

async function demonstrateMetamemory() {
    console.log('=== Metamemory Demonstration ===\n');
    console.log('This demo shows how metamemory tracks and compacts conversations.\n');
    
    // Configure metamemory
    configureMetamemory({
        windowSize: 6,
        processInterval: 2,  // Process every 2 messages
        threadInactivityTimeout: 10000,
        compactionThresholds: {
            core: 100,
            active: 70,
            complete: 50,
            ephemeral: 20
        }
    });
    
    // Enable metamemory
    setMetamemoryEnabled(true);
    console.log('✓ Metamemory enabled\n');
    
    // Create an agent
    const agent = new Agent({
        name: 'DemoAgent',
        modelClass: 'mini',
        instructions: `You are a helpful assistant. Keep responses concise. 
        When the user says "finished", use the task_complete tool to end the conversation.`
    });
    
    console.log('Starting conversation with multiple topics...\n');
    console.log('USER: Hi! Can you explain what a hash table is?\n');
    
    let finalState;
    const task = runTask(agent, 'Hi! Can you explain what a hash table is?', {
        metamemoryEnabled: true
    });
    
    let responseCount = 0;
    
    for await (const event of task) {
        if (event.type === 'content') {
            process.stdout.write(event.content);
        } else if (event.type === 'response_output') {
            responseCount++;
            
            if (responseCount === 1) {
                console.log('\n\nUSER: Thanks! Now, what\'s a good recipe for chocolate chip cookies?\n');
                addMessageToTask(task, {
                    type: 'message',
                    role: 'user',
                    content: 'Thanks! Now, what\'s a good recipe for chocolate chip cookies?'
                });
            } else if (responseCount === 2) {
                console.log('\n\nUSER: Perfect! One more thing - how do I center a div in CSS?\n');
                addMessageToTask(task, {
                    type: 'message',
                    role: 'user',
                    content: 'Perfect! One more thing - how do I center a div in CSS?'
                });
            } else if (responseCount === 3) {
                console.log('\n\nUSER: Finished.\n');
                addMessageToTask(task, {
                    type: 'message',
                    role: 'user',
                    content: 'Finished.'
                });
            }
        } else if (event.type === 'task_complete') {
            finalState = event.finalState;
            console.log('\n\n✓ Task completed');
        }
    }
    
    // Analyze metamemory
    if (finalState?.metamemoryState) {
        console.log('\n\n=== Metamemory Analysis ===\n');
        
        const state = finalState.metamemoryState;
        console.log(`Messages tracked: ${state.metamemory.size}`);
        console.log(`Threads identified: ${state.threads.size}`);
        
        // Show threads
        console.log('\nDetected conversation threads:');
        for (const [id, thread] of state.threads) {
            console.log(`\n- Thread: "${thread.name}"`);
            console.log(`  Messages: ${thread.messages.length}`);
            console.log(`  Class: ${thread.class}`);
            console.log(`  Status: ${thread.status}`);
        }
        
        // Compact the history
        console.log('\n\n=== Compacting Conversation ===\n');
        const compacted = await getCompactedHistory(finalState);
        
        if (compacted) {
            console.log(`Original messages: ${compacted.metadata.originalCount}`);
            console.log(`Compacted messages: ${compacted.metadata.compactedCount}`);
            console.log(`Reduction: ${Math.round((1 - compacted.metadata.compactedCount / compacted.metadata.originalCount) * 100)}%`);
            
            console.log('\nCompacted conversation:');
            console.log('------------------------');
            compacted.messages.forEach((msg, i) => {
                const marker = msg.isCompacted ? ' [SUMMARY]' : '';
                console.log(`\n${i + 1}. ${msg.role.toUpperCase()}${marker}:`);
                console.log(`   ${msg.content.substring(0, 150)}${msg.content.length > 150 ? '...' : ''}`);
            });
        }
    }
}

// Run the demo
demonstrateMetamemory().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});