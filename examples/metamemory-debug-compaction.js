/**
 * Debug Metamemory Compaction
 * Figure out why compaction is producing bad results
 */

import { config } from 'dotenv';
import { Agent } from '@just-every/ensemble';
import { 
    Metamemory,
    createMetamemoryState
} from '../dist/index.js';

config();

async function debugCompaction() {
    console.log('=== Debug Metamemory Compaction ===\n');
    
    // Create test messages
    const messages = [
        { 
            type: 'message', 
            role: 'system', 
            content: 'You are a helpful assistant. Be concise.',
            id: 'sys1'
        },
        { 
            type: 'message', 
            role: 'user', 
            content: 'What is recursion?',
            id: 'user1'
        },
        { 
            type: 'message', 
            role: 'assistant', 
            content: 'Recursion is when a function calls itself to solve a problem.',
            id: 'asst1'
        },
        { 
            type: 'message', 
            role: 'user', 
            content: 'Now explain closures in JavaScript',
            id: 'user2'
        },
        { 
            type: 'message', 
            role: 'assistant', 
            content: 'Closures are functions that remember their outer scope.',
            id: 'asst2'
        },
        { 
            type: 'message', 
            role: 'user', 
            content: 'What about REST APIs?',
            id: 'user3'
        },
        { 
            type: 'message', 
            role: 'assistant', 
            content: 'REST APIs use HTTP methods to interact with resources.',
            id: 'asst3'
        }
    ];
    
    // Initialize metamemory
    const metamemory = new Metamemory({
        windowSize: 10,
        processInterval: 2,
        compactionThresholds: {
            core: 100,
            active: 80,
            complete: 60,
            ephemeral: 20
        }
    });
    
    let state = createMetamemoryState();
    
    // Create a simple agent for testing
    const agent = new Agent({
        name: 'DebugAgent',
        modelClass: 'mini'
    });
    
    // Process messages
    console.log('Processing messages...\n');
    state = await metamemory.processMessages(
        messages,
        state,
        agent,
        { type: 'manual' }
    );
    
    console.log('📊 METAMEMORY STATE:');
    console.log(`   Messages tracked: ${state.metamemory.size}`);
    console.log(`   Threads created: ${state.threads.size}\n`);
    
    // Show what was tracked
    console.log('📝 MESSAGE TRACKING:');
    for (const [msgId, entry] of state.metamemory) {
        const msg = messages.find(m => m.id === msgId);
        console.log(`\n   ${msgId} (${msg?.role}):`);
        console.log(`   "${msg?.content?.substring(0, 50)}..."`);
        console.log(`   Threads: [${entry.threadIds.join(', ')}]`);
    }
    
    // Show threads
    console.log('\n\n🧵 THREADS:');
    for (const [id, thread] of state.threads) {
        console.log(`\n   Thread: ${id}`);
        console.log(`   Name: ${thread.name}`);
        console.log(`   Class: ${thread.class}`);
        console.log(`   Messages: [${thread.messages.join(', ')}]`);
    }
    
    // If no threads were created, manually create some for testing
    if (state.threads.size === 0) {
        console.log('\n\n⚠️  No threads detected! Creating manual threads for testing...\n');
        
        // Create threads manually
        state.threads.set('recursion-thread', {
            id: 'recursion-thread',
            name: 'Recursion Discussion',
            messages: ['user1', 'asst1'],
            status: 'complete',
            class: 'complete',
            lastUpdated: Date.now(),
            createdAt: Date.now(),
            summary: 'User asked about recursion, explained as self-calling functions.'
        });
        
        state.threads.set('closures-thread', {
            id: 'closures-thread',
            name: 'JavaScript Closures',
            messages: ['user2', 'asst2'],
            status: 'complete',
            class: 'complete',
            lastUpdated: Date.now(),
            createdAt: Date.now(),
            summary: 'Discussion about closures and scope retention.'
        });
        
        state.threads.set('api-thread', {
            id: 'api-thread',
            name: 'REST API Explanation',
            messages: ['user3', 'asst3'],
            status: 'active',
            class: 'active',
            lastUpdated: Date.now(),
            createdAt: Date.now()
        });
        
        // Update metamemory entries
        state.metamemory.set('user1', {
            messageId: 'user1',
            threadIds: ['recursion-thread'],
            timestamp: Date.now(),
            messageLength: messages[1].content.length,
            importance: 80
        });
        state.metamemory.set('asst1', {
            messageId: 'asst1',
            threadIds: ['recursion-thread'],
            timestamp: Date.now(),
            messageLength: messages[2].content.length,
            importance: 80
        });
        state.metamemory.set('user2', {
            messageId: 'user2',
            threadIds: ['closures-thread'],
            timestamp: Date.now(),
            messageLength: messages[3].content.length,
            importance: 80
        });
        state.metamemory.set('asst2', {
            messageId: 'asst2',
            threadIds: ['closures-thread'],
            timestamp: Date.now(),
            messageLength: messages[4].content.length,
            importance: 80
        });
        state.metamemory.set('user3', {
            messageId: 'user3',
            threadIds: ['api-thread'],
            timestamp: Date.now(),
            messageLength: messages[5].content.length,
            importance: 80
        });
        state.metamemory.set('asst3', {
            messageId: 'asst3',
            threadIds: ['api-thread'],
            timestamp: Date.now(),
            messageLength: messages[6].content.length,
            importance: 80
        });
    }
    
    // Now compact
    console.log('\n\n=== COMPACTING HISTORY ===\n');
    const compacted = await metamemory.compactHistory(messages, state);
    
    console.log(`Original messages: ${compacted.metadata.originalCount}`);
    console.log(`Compacted messages: ${compacted.metadata.compactedCount}`);
    console.log(`Threads preserved: [${compacted.metadata.threadsPreserved.join(', ')}]`);
    console.log(`Threads summarized: [${compacted.metadata.threadsSummarized.join(', ')}]`);
    
    console.log('\n📦 COMPACTED RESULT:');
    compacted.messages.forEach((msg, i) => {
        console.log(`\n${i + 1}. ${msg.isCompacted ? '[COMPACTED]' : msg.role?.toUpperCase() || 'UNKNOWN'}:`);
        console.log(`   ${msg.content}`);
        if (msg.threadIds) {
            console.log(`   (Threads: ${msg.threadIds.join(', ')})`);
        }
    });
}

// Run debug
debugCompaction().catch(error => {
    console.error('\nError:', error);
    process.exit(1);
});