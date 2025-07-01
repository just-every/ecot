/**
 * Clean Metamemory Demo
 * Shows metamemory in action with real LLM calls
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

// Load environment variables from .env file
config();

async function runCleanDemo() {
    console.log('=== Metamemory Demo ===\n');
    
    // Configure metamemory
    configureMetamemory({
        windowSize: 6,
        processInterval: 2,  // Process every 2 messages for demo
        threadInactivityTimeout: 30000,
        compactionThresholds: {
            core: 100,
            active: 80,
            complete: 60,
            ephemeral: 20
        }
    });
    
    setMetamemoryEnabled(true);
    
    // Create agent that will complete after a few exchanges
    const agent = new Agent({
        name: 'MetamemoryAgent',
        modelClass: 'standard',
        instructions: `You are a helpful assistant. Be concise. 
        Important: After answering 3 questions, when the user says anything else, 
        use the task_complete tool to end the conversation with a summary.`
    });
    
    console.log('Starting conversation with multiple topics...\n');
    console.log('USER: Hi! What is recursion?\n');
    
    let finalState;
    let messageCount = 0;
    
    const task = runTask(agent, 'Hi! What is recursion?', {
        metamemoryEnabled: true
    });
    
    for await (const event of task) {
        if (event.type === 'content') {
            process.stdout.write(event.content);
        } else if (event.type === 'response_output') {
            messageCount++;
            console.log(`\n[✓ Metamemory processed message ${messageCount}]\n`);
            
            if (messageCount === 1) {
                console.log('USER: Thanks! Now, what are closures in JavaScript?\n');
                addMessageToTask(task, {
                    type: 'message',
                    role: 'user', 
                    content: 'Thanks! Now, what are closures in JavaScript?'
                });
            } else if (messageCount === 2) {
                console.log('USER: Great! Last question - what is a REST API?\n');
                addMessageToTask(task, {
                    type: 'message',
                    role: 'user',
                    content: 'Great! Last question - what is a REST API?'
                });
            } else if (messageCount === 3) {
                console.log('USER: Perfect, that\'s all!\n');
                addMessageToTask(task, {
                    type: 'message',
                    role: 'user',
                    content: 'Perfect, that\'s all!'
                });
            }
        } else if (event.type === 'task_complete') {
            finalState = event.finalState;
            console.log('\n\n✓ Task completed successfully');
        } else if (event.type === 'error') {
            console.error('\nError:', event.error);
            break;
        }
    }
    
    // Analyze results
    if (finalState?.metamemoryState) {
        const state = finalState.metamemoryState;
        
        console.log('\n=== Metamemory Analysis ===\n');
        console.log(`Messages tracked: ${state.metamemory.size}`);
        console.log(`Threads identified: ${state.threads.size}`);
        
        // Show detected threads
        console.log('\nDetected threads:');
        for (const [id, thread] of state.threads) {
            console.log(`\n• "${thread.name}" (${thread.class})`);
            console.log(`  Messages: ${thread.messages.length}`);
            console.log(`  Status: ${thread.status}`);
            if (thread.summary) {
                console.log(`  Summary: ${thread.summary}`);
            }
        }
        
        // Compact and show results
        console.log('\n\n=== Compacting History ===\n');
        const compacted = await getCompactedHistory(finalState);
        
        if (compacted) {
            console.log(`Original messages: ${compacted.metadata.originalCount}`);
            console.log(`Compacted messages: ${compacted.metadata.compactedCount}`);
            console.log(`Space saved: ${Math.round((1 - compacted.metadata.compactedCount / compacted.metadata.originalCount) * 100)}%`);
            
            console.log('\nCompacted conversation:');
            console.log('------------------------');
            compacted.messages.forEach((msg, i) => {
                const marker = msg.isCompacted ? ' [COMPACTED]' : '';
                const role = msg.role.toUpperCase();
                const content = msg.content.substring(0, 100);
                const truncated = msg.content.length > 100 ? '...' : '';
                console.log(`\n${i + 1}. ${role}${marker}: ${content}${truncated}`);
            });
            
            console.log('\n\n=== Summary ===\n');
            console.log('The metamemory system successfully:');
            console.log('1. Tracked all messages in the conversation');
            console.log('2. Identified distinct conversation threads');
            console.log('3. Classified threads by importance (core/active/complete/ephemeral)');
            console.log('4. Compacted the conversation history while preserving key information');
            console.log('\nThis allows long conversations to maintain context without exceeding token limits.');
        }
    }
}

// Run demo
console.log('This demo demonstrates metamemory with real LLM calls.\n');
runCleanDemo().catch(error => {
    console.error('\nDemo error:', error);
    process.exit(1);
});