/**
 * Clean Metamemory Demo
 * Shows metamemory with a simpler, more controlled conversation flow
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

async function runCleanDemo() {
    console.log('=== Clean Metamemory Demo ===\n');
    console.log('This demo shows metamemory with a controlled conversation.\n');
    
    // Configure metamemory for demo
    configureMetamemory({
        windowSize: 15,
        processInterval: 2,  // Process every 2 messages
        threadInactivityTimeout: 3000,  // 3 seconds for demo
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
        name: 'CleanDemoAgent',
        modelClass: 'mini',  // Fast responses
        instructions: `You are a helpful programming tutor. Answer each question in 1-2 clear sentences.
        Topics will include recursion, closures, and REST APIs.
        When the user says "summarize", use the task_complete tool to summarize what we discussed.`
    });
    
    // Create a controlled conversation
    const conversation = [
        'What is recursion in programming?',
        'How do closures work in JavaScript?', 
        'What are REST APIs?',
        'Can you give an example of recursion?',
        'How are closures useful in practice?',
        'What HTTP methods do REST APIs use?',
        'summarize'
    ];
    
    console.log('Starting controlled conversation...\n');
    
    let finalState;
    let userMessageIndex = 0;
    
    // Start with first question
    const task = runTask(agent, conversation[userMessageIndex++], {
        metamemoryEnabled: true
    });
    
    for await (const event of task) {
        if (event.type === 'content') {
            process.stdout.write(event.content);
        } else if (event.type === 'response_output') {
            console.log('\n');
            
            // Wait a moment for metamemory to process
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Add next question if we have more
            if (userMessageIndex < conversation.length) {
                const nextQuestion = conversation[userMessageIndex++];
                console.log(`\nUSER: ${nextQuestion}\n`);
                
                // Send the next message to the agent
                await event.agent.sendMessage({
                    type: 'message',
                    role: 'user',
                    content: nextQuestion
                });
            }
        } else if (event.type === 'task_complete') {
            finalState = event.finalState;
            console.log('\n[✓ Task completed]');
            break;
        }
    }
    
    // Give final processing time
    console.log('\n[Waiting for final metamemory processing...]');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Show metamemory analysis
    if (finalState?.metamemoryState) {
        const state = finalState.metamemoryState;
        
        console.log('\n\n' + '█'.repeat(60));
        console.log('METAMEMORY ANALYSIS');
        console.log('█'.repeat(60));
        
        // Show message tracking
        console.log('\n📊 MESSAGE TRACKING:');
        console.log(`   Total messages: ${finalState.messages.length}`);
        console.log(`   Tracked by metamemory: ${state.metamemory.size}`);
        console.log(`   Tracking rate: ${Math.round(state.metamemory.size / finalState.messages.length * 100)}%\n`);
        
        // Show threads
        console.log('🧵 THREADS DETECTED:');
        for (const [id, thread] of state.threads) {
            console.log(`\n   "${thread.name}"`);
            console.log(`   - Status: ${thread.status} (${thread.class})`);
            console.log(`   - Messages: ${thread.messages.length}`);
        }
        
        // Show compaction
        console.log('\n\n' + '█'.repeat(60));
        console.log('CONVERSATION COMPACTION');
        console.log('█'.repeat(60));
        
        // Check if metamemory is ready
        if (!isMetamemoryReady(finalState)) {
            console.log('\n⚠️  Metamemory processing incomplete');
        } else {
            console.log('\n✓ Metamemory processing complete');
        }
        
        const compacted = await getCompactedHistory(finalState);
        
        if (compacted) {
            const reduction = Math.round((1 - compacted.metadata.compactedCount / compacted.metadata.originalCount) * 100);
            console.log(`\n📉 Messages: ${compacted.metadata.originalCount} → ${compacted.metadata.compactedCount} (${reduction}% reduction)`);
            
            if (compacted.metadata.originalTokens && compacted.metadata.compactedTokens) {
                const tokenReduction = Math.round((1 - compacted.metadata.compactedTokens / compacted.metadata.originalTokens) * 100);
                console.log(`   Tokens: ${compacted.metadata.originalTokens} → ${compacted.metadata.compactedTokens} (${tokenReduction}% reduction)`);
            }
            
            // Show what got compacted
            const summaries = compacted.messages.filter(m => m.isCompacted);
            if (summaries.length > 0) {
                console.log(`\n📦 THREAD SUMMARIES CREATED:`);
                summaries.forEach((summary, i) => {
                    console.log(`   ${i + 1}. ${summary.content}`);
                });
            }
            
            console.log('\n💡 CONCLUSION:');
            if (reduction > 0) {
                console.log('   ✅ Metamemory successfully compacted the conversation!');
                console.log('   📈 This enables much longer AI conversations with preserved context.');
            } else {
                console.log('   ℹ️  No compaction occurred (likely due to recent/active threads).');
                console.log('   🔄 Threads marked "complete" would be compacted in a real scenario.');
            }
        }
    }
}

// Run demo
runCleanDemo().catch(error => {
    console.error('\nError:', error);
    process.exit(1);
});