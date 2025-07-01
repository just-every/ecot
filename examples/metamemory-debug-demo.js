/**
 * Debug Metamemory Demo
 * Shows detailed metamemory processing output
 */

import { config } from 'dotenv';
import { Agent } from '@just-every/ensemble';
import { 
    runTask, 
    getCompactedHistory,
    configureMetamemory,
    setMetamemoryEnabled
} from '../dist/index.js';

config();

async function runDebugDemo() {
    console.log('=== Metamemory Debug Demo ===\n');
    
    // Configure metamemory for immediate processing
    configureMetamemory({
        windowSize: 5,
        processInterval: 1,  // Process every message
        threadInactivityTimeout: 5000,
        compactionThresholds: {
            core: 100,
            active: 80,
            complete: 60,
            ephemeral: 20
        }
    });
    
    setMetamemoryEnabled(true);
    
    // Create agent
    const agent = new Agent({
        name: 'DebugAgent',
        modelClass: 'mini',
        instructions: `You are a helpful assistant. Answer in 1-2 sentences max.
        When user says "done", respond "Great! Happy to help." and use task_complete.`
    });
    
    console.log('Starting debug conversation...\n');
    console.log('USER: What is recursion?\n');
    
    let finalState;
    let messageCount = 0;
    
    const task = runTask(agent, 'What is recursion?', {
        metamemoryEnabled: true
    });
    
    for await (const event of task) {
        if (event.type === 'content') {
            process.stdout.write(event.content);
        } else if (event.type === 'response_output') {
            console.log('\n');
            messageCount++;
            
            if (messageCount === 1) {
                // Give metamemory time to process
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                console.log('USER: How about closures?\n');
                event.messages = event.messages || [];
                event.messages.push({
                    type: 'message',
                    role: 'user',
                    content: 'How about closures?'
                });
            } else if (messageCount === 2) {
                // Give metamemory time to process
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                console.log('USER: done\n');
                event.messages = event.messages || [];
                event.messages.push({
                    type: 'message',
                    role: 'user',
                    content: 'done'
                });
            }
        } else if (event.type === 'task_complete') {
            finalState = event.finalState;
            console.log('\n✅ Task completed');
        }
    }
    
    // Final processing
    console.log('\nWaiting for final metamemory processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (finalState?.metamemoryState) {
        const state = finalState.metamemoryState;
        console.log('\n' + '='.repeat(60));
        console.log('FINAL METAMEMORY STATE');
        console.log('='.repeat(60));
        console.log(`Messages tracked: ${state.metamemory.size}`);
        console.log(`Threads created: ${state.threads.size}`);
        
        // Show final compaction
        const compacted = await getCompactedHistory(finalState);
        if (compacted) {
            console.log(`\nCompaction: ${compacted.metadata.originalCount} → ${compacted.metadata.compactedCount} messages`);
        }
    }
}

runDebugDemo().catch(console.error);