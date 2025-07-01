/**
 * Simple Long Metamemory Demo
 * A simpler approach to demonstrate compaction
 */

import { config } from 'dotenv';
import { Agent } from '@just-every/ensemble';
import { 
    runTask, 
    getCompactedHistory,
    configureMetamemory,
    setMetamemoryEnabled,
    addMessageToTask
} from '../dist/index.js';

config();

async function simpleLongDemo() {
    console.log('=== Simple Long Metamemory Demo ===\n');
    
    // Configure for aggressive processing
    configureMetamemory({
        windowSize: 5,
        processInterval: 1,  // Process every message
        threadInactivityTimeout: 2000,
        compactionThresholds: {
            core: 100,
            active: 80,
            complete: 40,  // Lower threshold for demo
            ephemeral: 20
        }
    });
    
    setMetamemoryEnabled(true);
    
    const agent = new Agent({
        name: 'SimpleLongAgent',
        modelClass: 'mini',
        instructions: 'Answer very briefly (10 words max). When user says "done", use task_complete.'
    });
    
    console.log('Creating a conversation with multiple topics...\n');
    
    let finalState;
    let responseCount = 0;
    
    // Start with first topic
    const task = runTask(agent, 'What is Python?', {
        metamemoryEnabled: true
    });
    
    const questions = [
        'Is Python interpreted or compiled?',
        'Thanks. Now what is JavaScript?',
        'Is JavaScript synchronous?',
        'Great. Tell me about databases',
        'What is SQL?',
        'Perfect. Now explain APIs',
        'What is REST?'
    ];
    
    for await (const event of task) {
        if (event.type === 'content') {
            process.stdout.write(event.content);
        } else if (event.type === 'response_output') {
            console.log('\n');
            responseCount++;
            
            // Give metamemory time to process
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (responseCount <= questions.length) {
                console.log(`USER: ${questions[responseCount - 1]}\n`);
                addMessageToTask(task, {
                    type: 'message',
                    role: 'user',
                    content: questions[responseCount - 1]
                });
            } else {
                // Wait before final message
                console.log('[Giving metamemory 5 seconds to process...]');
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                console.log('\nUSER: done\n');
                addMessageToTask(task, {
                    type: 'message',
                    role: 'user',
                    content: 'done'
                });
            }
        } else if (event.type === 'task_complete') {
            finalState = event.finalState;
            console.log('\n✓ Task completed');
        }
    }
    
    if (finalState?.metamemoryState) {
        const state = finalState.metamemoryState;
        
        console.log('\n=== METAMEMORY RESULTS ===');
        console.log(`Messages: ${finalState.messages.length}`);
        console.log(`Tracked: ${state.metamemory.size}`);
        console.log(`Threads: ${state.threads.size}`);
        
        // Show threads
        if (state.threads.size > 0) {
            console.log('\nThreads created:');
            for (const [id, thread] of state.threads) {
                console.log(`- ${thread.name} (${thread.status}, ${thread.messages.length} msgs)`);
            }
        }
        
        // Get compaction
        const compacted = await getCompactedHistory(finalState);
        
        if (compacted) {
            console.log('\n=== COMPACTION ===');
            console.log(`Messages: ${compacted.metadata.originalCount} → ${compacted.metadata.compactedCount}`);
            
            if (compacted.metadata.originalTokens && compacted.metadata.compactedTokens) {
                const saved = Math.round((1 - compacted.metadata.compactedTokens / compacted.metadata.originalTokens) * 100);
                console.log(`Tokens: ${compacted.metadata.originalTokens} → ${compacted.metadata.compactedTokens} (${saved}% saved)`);
            }
            
            // Count summaries
            const summaries = compacted.messages.filter(m => m.isCompacted);
            if (summaries.length > 0) {
                console.log(`\n✓ Created ${summaries.length} thread summaries:`);
                summaries.forEach(s => {
                    console.log(`\n[SUMMARY] ${s.content}`);
                });
            }
            
            // Show final compacted conversation
            console.log('\n=== FINAL COMPACTED CONVERSATION ===');
            let userMsgCount = 0;
            compacted.messages.forEach(msg => {
                if (msg.role === 'user') {
                    userMsgCount++;
                    console.log(`\n${userMsgCount}. USER: ${msg.content}`);
                } else if (msg.role === 'assistant' && !msg.isCompacted) {
                    console.log(`   ASSISTANT: ${msg.content.substring(0, 50)}...`);
                } else if (msg.isCompacted) {
                    console.log(`   [THREAD SUMMARY]: ${msg.content.substring(0, 80)}...`);
                }
            });
        }
    }
}

simpleLongDemo().catch(console.error);