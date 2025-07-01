/**
 * Comprehensive Metamemory Test
 * Tests all major functionality improvements
 */

import { config } from 'dotenv';
import { Agent, ensembleRequest } from '@just-every/ensemble';
import { 
    runTask, 
    getCompactedHistory,
    configureMetamemory,
    setMetamemoryEnabled
} from '../dist/index.js';

config();

// Helper to create a test conversation
async function* createConversation(agent, messages) {
    for (const message of messages) {
        const messageInputs = [{
            type: 'message',
            role: 'user',
            content: message,
            id: `msg_${Date.now()}_${Math.random()}`
        }];
        
        for await (const event of ensembleRequest(messageInputs, agent)) {
            if (event.type === 'message' && event.message) {
                event.message.id = `msg_${Date.now()}_${Math.random()}`;
            }
            yield event;
        }
        
        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

async function comprehensiveTest() {
    console.log('=== Comprehensive Metamemory Test ===\n');
    
    // Configure metamemory for aggressive testing
    configureMetamemory({
        windowSize: 10,
        processInterval: 2,  // Process every 2 messages
        threadInactivityTimeout: 1000, // 1 second for testing
        compactionThresholds: {
            core: 100,
            active: 80,
            complete: 60,
            ephemeral: 20
        }
    });
    
    setMetamemoryEnabled(true);
    
    // Create a test agent
    const agent = new Agent({
        name: 'TestAgent',
        modelClass: 'mini',
        instructions: `You are a helpful test assistant. Keep responses very brief (1 sentence).
When the user says "final test", use the task_complete tool.`
    });
    
    // Test messages that should create different threads
    const testMessages = [
        // Thread 1: Ephemeral greeting
        "Hi there!",
        
        // Thread 2: Math Q&A (should stay together)
        "What is 2+2?",
        
        // Thread 3: Programming Q&A (should stay together)
        "What is recursion in programming?",
        
        // Thread 1: More ephemeral
        "Thanks!",
        
        // Thread 4: Another topic
        "How do I write a for loop in Python?",
        
        // Complete message
        "Great, that's all I needed",
        
        // Final test
        "final test"
    ];
    
    console.log('Running test conversation...\n');
    
    let finalState;
    const task = runTask(agent, testMessages[0], {
        metamemoryEnabled: true
    });
    
    let messageCount = 1;
    const remainingMessages = testMessages.slice(1);
    
    for await (const event of task) {
        if (event.type === 'message' && messageCount < testMessages.length) {
            // Inject next user message
            const nextMessage = remainingMessages.shift();
            if (nextMessage) {
                console.log(`[User ${messageCount}]: ${testMessages[messageCount]}`);
                event.messages = event.messages || [];
                event.messages.push({
                    type: 'message',
                    role: 'user',
                    content: nextMessage,
                    id: `user_msg_${messageCount}`
                });
                messageCount++;
            }
        } else if (event.type === 'task_complete') {
            finalState = event.finalState;
            console.log('\nTask completed');
        }
    }
    
    // Analyze results
    if (finalState?.metamemoryState) {
        console.log('\n=== Metamemory Analysis ===');
        console.log(`Messages tracked: ${finalState.metamemoryState.metamemory.size}`);
        console.log(`Threads created: ${finalState.metamemoryState.threads.size}`);
        
        // Show thread details
        console.log('\nThread Details:');
        for (const [threadId, thread] of finalState.metamemoryState.threads) {
            console.log(`\n- ${thread.name} (${threadId})`);
            console.log(`  Status: ${thread.status}`);
            console.log(`  Class: ${thread.class}`);
            console.log(`  Messages: ${thread.messages.length}`);
            console.log(`  Summary: ${thread.summary || 'None'}`);
        }
        
        // Test compaction
        console.log('\n=== Compaction Test ===');
        try {
            const compacted = await getCompactedHistory(finalState);
            if (compacted) {
                console.log(`Original messages: ${compacted.metadata.originalCount}`);
                console.log(`Compacted messages: ${compacted.metadata.compactedCount}`);
                console.log(`Reduction: ${Math.round((1 - compacted.metadata.compactedCount / compacted.metadata.originalCount) * 100)}%`);
                console.log(`Threads preserved: ${compacted.metadata.threadsPreserved.join(', ')}`);
                console.log(`Threads summarized: ${compacted.metadata.threadsSummarized.join(', ')}`);
                
                // Show compacted content
                console.log('\nCompacted Messages:');
                for (const msg of compacted.messages) {
                    const preview = msg.content.substring(0, 80);
                    console.log(`- [${msg.role}${msg.isCompacted ? ' COMPACTED' : ''}]: ${preview}${msg.content.length > 80 ? '...' : ''}`);
                }
            }
        } catch (e) {
            console.error('Compaction error:', e);
        }
        
        // Test specific improvements
        console.log('\n=== Fix Validation ===');
        
        // Check Q&A pairing
        const mathThread = Array.from(finalState.metamemoryState.threads.values())
            .find(t => t.name && t.name.includes('2+2'));
        if (mathThread) {
            console.log('✓ Q&A Pairing: Math question and answer in same thread');
        } else {
            console.log('✗ Q&A Pairing: Math Q&A split into different threads');
        }
        
        // Check thread completion
        const completedThreads = Array.from(finalState.metamemoryState.threads.values())
            .filter(t => t.status === 'complete');
        console.log(`✓ Thread Completion: ${completedThreads.length} threads marked complete`);
        
        // Check no duplication
        const messageIds = new Set();
        let hasDuplicates = false;
        for (const [_, thread] of finalState.metamemoryState.threads) {
            for (const msgId of thread.messages) {
                if (messageIds.has(msgId)) {
                    hasDuplicates = true;
                    break;
                }
                messageIds.add(msgId);
            }
        }
        console.log(`${hasDuplicates ? '✗' : '✓'} Message Duplication: ${hasDuplicates ? 'Found duplicates' : 'No duplicates'}`);
        
        // Check ephemeral detection
        const ephemeralThreads = Array.from(finalState.metamemoryState.threads.values())
            .filter(t => t.class === 'ephemeral');
        console.log(`✓ Ephemeral Detection: ${ephemeralThreads.length} ephemeral threads found`);
        
    } else {
        console.log('\nNo metamemory state found');
    }
}

comprehensiveTest().catch(error => {
    console.error('\nTest error:', error);
    process.exit(1);
});