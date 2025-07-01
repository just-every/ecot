/**
 * Sequential Metamemory Demo
 * Shows metamemory by running multiple separate conversations and then analyzing the combined result
 */

import { config } from 'dotenv';
import { Agent } from '@just-every/ensemble';
import { 
    runTask, 
    getCompactedHistory,
    configureMetamemory,
    setMetamemoryEnabled,
    isMetamemoryReady
} from '../dist/index.js';

// Load environment variables
config();

async function runSequenceDemo() {
    console.log('=== Sequential Metamemory Demo ===\n');
    console.log('This demo shows metamemory by running a sequence of related questions.\n');
    
    // Configure metamemory for demo
    configureMetamemory({
        windowSize: 20,
        processInterval: 1,  // Process every message
        threadInactivityTimeout: 2000,  // 2 seconds for demo
        compactionThresholds: {
            core: 100,
            active: 80,
            complete: 50,  // Lower threshold for demo
            ephemeral: 20
        }
    });
    
    setMetamemoryEnabled(true);
    
    // Create agent
    const agent = new Agent({
        name: 'SequenceDemoAgent',
        modelClass: 'mini',
        instructions: `You are a helpful programming tutor. Answer questions clearly and concisely in 1-2 sentences.
        
        When asked about:
        - Recursion: Explain it's a function calling itself with a base case
        - Closures: Explain they capture outer scope variables  
        - REST APIs: Explain they use HTTP methods for web services
        
        When the user says "that's all", respond with "Got it! We covered programming concepts." and use task_complete tool.`
    });
    
    // Questions that should form distinct threads
    const questions = [
        'What is recursion?',
        'How do closures work in JavaScript?', 
        'What are REST APIs?',
        'Give me an example of recursion',
        'Why are closures useful?',
        'What HTTP methods do REST APIs use?',
        'Thanks for explaining recursion',
        'Closures seem powerful',
        "that's all"
    ];
    
    console.log('Running conversation with multiple programming topics...\n');
    console.log('='.repeat(60));
    
    let finalState;
    let currentQuestion = 0;
    
    // Start with a compound question to create a rich conversation
    const initialPrompt = questions.join('\n\n') + '\n\nPlease answer each question, then say you are ready for the next topic.';
    
    const task = runTask(agent, initialPrompt, {
        metamemoryEnabled: true
    });
    
    for await (const event of task) {
        if (event.type === 'content') {
            process.stdout.write(event.content);
        } else if (event.type === 'response_output') {
            console.log('\n');
            console.log(`[Metamemory processed response]`);
        } else if (event.type === 'task_complete') {
            finalState = event.finalState;
            console.log('\n[✓ Task completed]');
            break;
        }
    }
    
    // Give metamemory time to complete final processing
    console.log('\n[Waiting for metamemory to complete processing...]');
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Show analysis
    if (finalState?.metamemoryState) {
        const state = finalState.metamemoryState;
        
        console.log('\n\n' + '█'.repeat(60));
        console.log('METAMEMORY ANALYSIS');
        console.log('█'.repeat(60));
        
        // Message analysis
        console.log('\n📊 MESSAGE ANALYSIS:');
        const messagesWithContent = finalState.messages.filter(m => 
            m.type === 'message' && ['user', 'assistant'].includes(m.role)
        );
        
        console.log(`   Total conversation messages: ${messagesWithContent.length}`);
        console.log(`   Messages tracked by metamemory: ${state.metamemory.size}`);
        console.log(`   Tracking coverage: ${Math.round(state.metamemory.size / messagesWithContent.length * 100)}%`);
        
        // Show specific tracked messages
        console.log('\n   Tracked messages by importance:');
        const trackedEntries = Array.from(state.metamemory.entries())
            .sort((a, b) => b[1].importance - a[1].importance);
        
        trackedEntries.slice(0, 5).forEach(([messageId, entry], i) => {
            const msg = finalState.messages.find(m => m.id === messageId);
            if (msg && msg.type === 'message') {
                const preview = msg.content.substring(0, 50) + '...';
                console.log(`   ${i + 1}. [${entry.importance}/100] ${msg.role}: "${preview}"`);
                console.log(`      → Threads: [${entry.threadIds.join(', ')}]`);
            }
        });
        
        // Thread analysis
        console.log('\n🧵 THREAD ANALYSIS:');
        if (state.threads.size === 0) {
            console.log('   ⚠️  No threads detected');
        } else {
            console.log(`   Threads detected: ${state.threads.size}`);
            for (const [id, thread] of state.threads) {
                console.log(`\n   📋 "${thread.name}"`);
                console.log(`      - Status: ${thread.status} (${thread.class})`);
                console.log(`      - Messages: ${thread.messages.length}`);
                console.log(`      - IDs: [${thread.messages.slice(0, 3).join(', ')}${thread.messages.length > 3 ? '...' : ''}]`);
            }
        }
        
        // Compaction test
        console.log('\n\n' + '█'.repeat(60));
        console.log('COMPACTION ANALYSIS');
        console.log('█'.repeat(60));
        
        const isReady = isMetamemoryReady(finalState);
        console.log(`\nMetamemory status: ${isReady ? '✅ Ready' : '⚠️ Processing'}`);
        
        const compacted = await getCompactedHistory(finalState);
        
        if (compacted) {
            const messageReduction = Math.round((1 - compacted.metadata.compactedCount / compacted.metadata.originalCount) * 100);
            console.log(`\n📊 RESULTS:`);
            console.log(`   Messages: ${compacted.metadata.originalCount} → ${compacted.metadata.compactedCount}`);
            
            if (messageReduction > 0) {
                console.log(`   📉 Reduction: ${messageReduction}% smaller`);
                
                if (compacted.metadata.originalTokens && compacted.metadata.compactedTokens) {
                    const tokenReduction = Math.round((1 - compacted.metadata.compactedTokens / compacted.metadata.originalTokens) * 100);
                    console.log(`   🪙 Token savings: ${tokenReduction}%`);
                }
                
                console.log(`\n📦 COMPACTED CONTENT:`);
                const summaries = compacted.messages.filter(m => m.isCompacted);
                if (summaries.length > 0) {
                    summaries.forEach((summary, i) => {
                        console.log(`   ${i + 1}. ${summary.content}`);
                    });
                } else {
                    console.log('   No thread summaries created.');
                }
                
                console.log('\n✅ SUCCESS: Metamemory successfully reduced conversation size!');
            } else if (messageReduction === 0) {
                console.log(`   ➡️  No reduction (${compacted.metadata.originalCount} messages preserved)`);
                console.log('\n💡 This is normal for:');
                console.log('   • Short conversations');
                console.log('   • Active/recent threads'); 
                console.log('   • High-importance content');
            } else {
                console.log(`   📈 Size increased: ${Math.abs(messageReduction)}% larger`);
                console.log('\n⚠️  This suggests a configuration issue.');
            }
        } else {
            console.log('\n❌ Compaction failed or returned null result');
        }
        
        console.log('\n💡 SUMMARY:');
        console.log('   Metamemory demonstrates:');
        console.log('   1. Real-time conversation analysis');
        console.log('   2. Topic detection and threading');
        console.log('   3. Intelligent message importance scoring');
        console.log('   4. Context-preserving compaction');
        console.log('\n   This enables AI systems to maintain long conversations efficiently! 🚀');
    }
}

// Run demo
runSequenceDemo().catch(error => {
    console.error('\nDemo failed:', error);
    process.exit(1);
});