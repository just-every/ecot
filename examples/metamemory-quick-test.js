/**
 * Quick Metamemory Test
 * Tests core fixes without full conversation simulation
 */

import { config } from 'dotenv';
import { MessageProcessor } from '../dist/src/metamemory/processor.js';
import { ThreadSummarizer } from '../dist/src/metamemory/summarizer.js';
import { HistoryCompactor } from '../dist/src/metamemory/compactor.js';

config();

async function quickTest() {
    console.log('=== Quick Metamemory Fix Test ===\n');
    
    // Create test components
    const processor = new MessageProcessor({
        windowSize: 10,
        processInterval: 2
    });
    
    const summarizer = new ThreadSummarizer();
    const compactor = new HistoryCompactor();
    
    // Create test messages
    const messages = [
        { id: 'msg1', type: 'message', role: 'user', content: 'Hi there!' },
        { id: 'msg2', type: 'message', role: 'assistant', content: 'Hello! How can I help you today?' },
        { id: 'msg3', type: 'message', role: 'user', content: 'What is recursion?' },
        { id: 'msg4', type: 'message', role: 'assistant', content: 'Recursion is when a function calls itself.' },
        { id: 'msg5', type: 'message', role: 'user', content: 'Can you give an example?' },
        { id: 'msg6', type: 'message', role: 'assistant', content: 'Sure! Here\'s a factorial function...' },
        { id: 'msg7', type: 'message', role: 'user', content: 'Thanks, that helps!' }
    ];
    
    // Initialize state
    let state = {
        metamemory: new Map(),
        threads: new Map(),
        lastProcessedIndex: 0,
        lastProcessedTime: Date.now()
    };
    
    // Test 1: Process messages and check Q&A pairing
    console.log('Test 1: Q&A Pairing\n');
    
    // Process first batch
    state = await processor.processMessages(
        messages.slice(0, 4),
        state,
        null,
        { type: 'interval' }
    );
    
    console.log('After first batch:');
    console.log(`- Threads created: ${state.threads.size}`);
    for (const [id, thread] of state.threads) {
        console.log(`  - ${thread.name}: ${thread.messages.length} messages`);
    }
    
    // Process second batch
    state = await processor.processMessages(
        messages,
        state,
        null,
        { type: 'interval' }
    );
    
    console.log('\nAfter second batch:');
    console.log(`- Threads created: ${state.threads.size}`);
    
    // Check if Q&A pairs are together
    let qaPaired = false;
    for (const [id, thread] of state.threads) {
        if (thread.messages.includes('msg3') && thread.messages.includes('msg4')) {
            qaPaired = true;
            console.log(`  ✓ Q&A paired in thread: ${thread.name}`);
        }
    }
    if (!qaPaired) {
        console.log('  ✗ Q&A not properly paired');
    }
    
    // Test 2: Thread completion detection
    console.log('\n\nTest 2: Thread Completion\n');
    
    // Wait a bit and reprocess to trigger completion
    await new Promise(resolve => setTimeout(resolve, 1500));
    state = await processor.processMessages(
        messages,
        state,
        null,
        { type: 'time_gap', threshold: 1000 }
    );
    
    const completedThreads = Array.from(state.threads.values())
        .filter(t => t.status === 'complete');
    console.log(`Completed threads: ${completedThreads.length}`);
    for (const thread of completedThreads) {
        console.log(`  - ${thread.name} marked complete`);
    }
    
    // Test 3: Summarization
    console.log('\n\nTest 3: Thread Summarization\n');
    
    state.threads = await summarizer.summarizeThreads(state, messages, null);
    
    for (const [id, thread] of state.threads) {
        if (thread.summary) {
            console.log(`Thread ${thread.name}:`);
            console.log(`  - Class: ${thread.class}`);
            console.log(`  - Summary: ${thread.summary}`);
        }
    }
    
    // Test 4: Compaction without duplication
    console.log('\n\nTest 4: Compaction\n');
    
    const compactionResult = await compactor.compactHistory(messages, state);
    
    console.log(`Original messages: ${compactionResult.metadata.originalCount}`);
    console.log(`Compacted messages: ${compactionResult.metadata.compactedCount}`);
    console.log(`Reduction: ${Math.round((1 - compactionResult.metadata.compactedCount / compactionResult.metadata.originalCount) * 100)}%`);
    
    // Check for duplicates
    const seenContent = new Set();
    let duplicates = 0;
    for (const msg of compactionResult.messages) {
        const key = `${msg.role}:${msg.content}`;
        if (seenContent.has(key) && !msg.isCompacted) {
            duplicates++;
            console.log(`  ✗ Duplicate found: ${msg.content.substring(0, 50)}...`);
        }
        seenContent.add(key);
    }
    
    if (duplicates === 0) {
        console.log('  ✓ No duplicate messages in compacted output');
    }
    
    // Test 5: Ephemeral detection
    console.log('\n\nTest 5: Ephemeral Detection\n');
    
    const ephemeralThreads = Array.from(state.threads.values())
        .filter(t => t.class === 'ephemeral');
    
    if (ephemeralThreads.length > 0) {
        console.log(`✓ Found ${ephemeralThreads.length} ephemeral threads:`);
        for (const thread of ephemeralThreads) {
            console.log(`  - ${thread.name}`);
        }
    } else {
        console.log('✗ No ephemeral threads detected');
    }
    
    console.log('\n=== All Tests Complete ===');
}

quickTest().catch(error => {
    console.error('\nTest error:', error);
    process.exit(1);
});