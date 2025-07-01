/**
 * Visual Metamemory Demo
 * Shows exactly what metamemory does with clear before/after visualization
 */

import { config } from 'dotenv';
import { Agent } from '@just-every/ensemble';
import { 
    runTask, 
    getCompactedHistory,
    configureMetamemory,
    setMetamemoryEnabled,
    addMessageToTask,
    isMetamemoryReady
} from '../dist/index.js';

// Load environment variables
config();

async function runVisualDemo() {
    console.log('=== Visual Metamemory Demo ===\n');
    console.log('This demo shows exactly how metamemory analyzes and compacts conversations.\n');
    
    // Configure metamemory for demo
    configureMetamemory({
        windowSize: 10,
        processInterval: 2,  // Process every 2 messages
        threadInactivityTimeout: 2000,  // 2 seconds for demo
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
        name: 'VisualDemoAgent',
        modelClass: 'mini',  // Fast responses
        instructions: `You are a helpful assistant. Be very concise - respond in 1-2 sentences max.
        When the user says "done", use the task_complete tool with a summary.`
    });
    
    console.log('Starting conversation...\n');
    console.log('='.repeat(60));
    console.log('USER: What is recursion?');
    console.log('='.repeat(60));
    
    let finalState;
    let messageCount = 0;
    const conversations = [];
    
    const task = runTask(agent, 'What is recursion?', {
        metamemoryEnabled: true
    });
    
    for await (const event of task) {
        if (event.type === 'content') {
            process.stdout.write(event.content);
        } else if (event.type === 'response_output') {
            console.log('\n');
            messageCount++;
            
            // Store conversation for display
            const responseEvent = event;
            if (responseEvent.message) {
                conversations.push({
                    role: 'assistant',
                    content: responseEvent.message.content
                });
            }
            
            console.log(`[✓ Message ${messageCount} processed by metamemory]`);
            
            // Give metamemory time to process the Q&A pair before adding next message
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (messageCount === 1) {
                console.log('\n' + '='.repeat(60));
                console.log('USER: Now explain closures in JavaScript');
                console.log('='.repeat(60));
                conversations.push({
                    role: 'user',
                    content: 'Now explain closures in JavaScript'
                });
                addMessageToTask(task, {
                    type: 'message',
                    role: 'user', 
                    content: 'Now explain closures in JavaScript'
                });
            } else if (messageCount === 2) {
                console.log('\n' + '='.repeat(60));
                console.log('USER: What about REST APIs?');
                console.log('='.repeat(60));
                conversations.push({
                    role: 'user',
                    content: 'What about REST APIs?'
                });
                addMessageToTask(task, {
                    type: 'message',
                    role: 'user',
                    content: 'What about REST APIs?'
                });
            } else if (messageCount === 3) {
                console.log('\n' + '='.repeat(60));
                console.log('USER: done');
                console.log('='.repeat(60));
                conversations.push({
                    role: 'user',
                    content: 'done'
                });
                addMessageToTask(task, {
                    type: 'message',
                    role: 'user',
                    content: 'done'
                });
            }
        } else if (event.type === 'task_complete') {
            finalState = event.finalState;
            console.log('\n[✓ Task completed]');
        }
    }
    
    // Wait a bit more to ensure metamemory completes processing
    console.log('\n[⏳ Waiting for metamemory to complete processing...]');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Show metamemory analysis
    if (finalState?.metamemoryState) {
        const state = finalState.metamemoryState;
        
        console.log('\n\n' + '█'.repeat(60));
        console.log('METAMEMORY ANALYSIS');
        console.log('█'.repeat(60));
        
        // Show what metamemory tracked
        console.log('\n📊 METAMEMORY MAP:');
        console.log('   (How each message was categorized)\n');
        
        let msgIndex = 1;
        for (const [msgId, entry] of state.metamemory) {
            const msg = finalState.messages.find(m => m.id === msgId);
            if (msg && msg.type === 'message') {
                console.log(`   Message ${msgIndex} (${msg.role}):`);
                console.log(`   "${msg.content.substring(0, 50)}..."`);
                console.log(`   → Threads: [${entry.threadIds.join(', ')}]`);
                console.log(`   → Importance: ${entry.importance}/100`);
                console.log(`   → Size: ${entry.messageLength} chars\n`);
                msgIndex++;
            }
        }
        
        // Show threads detected
        console.log('\n🧵 THREADS DETECTED:');
        for (const [id, thread] of state.threads) {
            console.log(`\n   "${thread.name}"`);
            console.log(`   - ID: ${id}`);
            console.log(`   - Class: ${thread.class}`);
            console.log(`   - Status: ${thread.status}`);
            console.log(`   - Contains messages: [${thread.messages.join(', ')}]`);
        }
        
        // Show compaction
        console.log('\n\n' + '█'.repeat(60));
        console.log('CONVERSATION COMPACTION');
        console.log('█'.repeat(60));
        
        // Check if metamemory is ready
        if (!isMetamemoryReady(finalState)) {
            console.log('\n⚠️  Metamemory processing incomplete');
            console.log('   The engine already waited but processing didn\'t finish in time.');
        } else {
            console.log('\n✓ Metamemory processing complete');
        }
        
        const compacted = await getCompactedHistory(finalState);
        
        if (compacted) {
            console.log(`\n📉 Reduction: ${compacted.metadata.originalCount} → ${compacted.metadata.compactedCount} messages`);
            if (compacted.metadata.originalTokens && compacted.metadata.compactedTokens) {
                const tokenReduction = Math.round((1 - compacted.metadata.compactedTokens / compacted.metadata.originalTokens) * 100);
                console.log(`   Token reduction: ${compacted.metadata.originalTokens} → ${compacted.metadata.compactedTokens} tokens (${tokenReduction}% saved)`);
            } else {
                console.log(`   Space saved: ${Math.round((1 - compacted.metadata.compactedCount / compacted.metadata.originalCount) * 100)}%`);
            }
            
            console.log('\n📜 BEFORE (Original Conversation):');
            console.log('   ' + '-'.repeat(50));
            finalState.messages.forEach((msg, i) => {
                if (msg.type === 'message') {
                    console.log(`   ${i + 1}. ${msg.role.toUpperCase()}: ${msg.content}`);
                }
            });
            
            console.log('\n\n📦 AFTER (Compacted):');
            console.log('   ' + '-'.repeat(50));
            compacted.messages.forEach((msg, i) => {
                if (msg.isCompacted) {
                    console.log(`   ${i + 1}. [COMPACTED THREAD]`);
                    console.log(`      ${msg.content}`);
                } else {
                    console.log(`   ${i + 1}. ${msg.role.toUpperCase()}: ${msg.content}`);
                }
            });
            
            console.log('\n\n💡 SUMMARY:');
            console.log('   The metamemory system:');
            console.log('   1. Analyzed the conversation in real-time');
            console.log('   2. Identified distinct topics as threads');
            console.log('   3. Classified thread importance');
            console.log('   4. Compacted the history while preserving context');
            console.log('\n   This allows AI to handle much longer conversations!');
        }
    }
}

// Run demo
runVisualDemo().catch(error => {
    console.error('\nError:', error);
    process.exit(1);
});