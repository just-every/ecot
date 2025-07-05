/**
 * Example: Using the new MetaMemory system with Task
 * 
 * This example demonstrates how to use the topic-based metamemory system
 * to manage long-running conversations with intelligent context management.
 */

import { Agent } from '@just-every/ensemble';
import { runTask, resumeTask } from '../src/core/engine.js';
import { setMetamemoryEnabled, configureMetamemory } from '../src/state/state.js';

async function main() {
    // Create an agent
    const agent = new Agent({ 
        name: 'ResearchAgent',
        modelClass: 'reasoning',
        instructions: 'You are a helpful research assistant. Use the task_complete tool when you finish a task.'
    });

    // Enable metamemory globally
    setMetamemoryEnabled(true);
    
    // Configure metamemory options
    configureMetamemory({
        windowSize: 20,                    // Process last 20 messages at a time
        processInterval: 10000,            // Process every 10 seconds
        threadInactivityTimeout: 3600000,  // 1 hour before marking threads idle
        maxThreadsToTrack: 50,
        compactionThresholds: {
            core: 100000,      // Core threads never compacted
            active: 20000,     // Active threads compacted at 20k tokens
            complete: 5000,    // Completed threads heavily summarized
            ephemeral: 1000    // Ephemeral content aggressively pruned
        }
    });

    console.log('Starting research task with metamemory enabled...\n');

    // Run initial task
    let finalState;
    for await (const event of runTask(agent, `
        Research the following topics in sequence:
        1. Latest developments in quantum computing
        2. Applications of quantum computing in cryptography
        3. Timeline for practical quantum computers
        
        For each topic, provide a comprehensive summary with key points.
        Mark yourself as complete when all topics are researched.
    `)) {
        if (event.type === 'task_complete') {
            console.log('\n✅ Initial research completed!');
            finalState = event.finalState;
            
            // Show metamemory stats
            if (finalState.metamemoryState) {
                const stats = finalState.metamemoryState.stats;
                console.log('\nMetaMemory Statistics:');
                console.log(`- Total threads: ${stats.totalThreads}`);
                console.log(`- Active threads: ${stats.activeThreads}`);
                console.log(`- Total messages processed: ${stats.totalMessages}`);
                console.log(`- Messages compacted: ${stats.compactedMessages}`);
            }
        } else if (event.type === 'response_output') {
            // Show assistant responses
            const response = event as any;
            if (response.message?.content) {
                console.log('\n' + response.message.content);
            }
        }
    }

    // Simulate a break - metamemory will organize the conversation
    console.log('\n--- Taking a break, metamemory organizing topics... ---\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Resume with a follow-up question on a previous topic
    console.log('Resuming with follow-up question...\n');
    
    for await (const event of resumeTask(
        agent, 
        finalState!,
        'Can you elaborate more on how quantum computing threatens current encryption methods? Focus on RSA and ECC specifically.'
    )) {
        if (event.type === 'response_output') {
            const response = event as any;
            if (response.message?.content) {
                console.log('\n' + response.message.content);
            }
        } else if (event.type === 'task_complete') {
            console.log('\n✅ Follow-up research completed!');
            finalState = event.finalState;
            
            // Show how metamemory organized the topics
            if (finalState.metamemoryState) {
                console.log('\nMetaMemory Topic Organization:');
                for (const thread of finalState.metamemoryState.threads) {
                    console.log(`\nTopic: ${thread.name}`);
                    console.log(`- Status: ${thread.status}`);
                    console.log(`- Class: ${thread.class}`);
                    console.log(`- Messages: ${thread.messages.length}`);
                    if (thread.summary) {
                        console.log(`- Summary: ${thread.summary.substring(0, 100)}...`);
                    }
                }
            }
        }
    }

    // Demonstrate topic switching - metamemory will reactivate the relevant thread
    console.log('\n--- Switching to a different topic... ---\n');
    
    for await (const event of resumeTask(
        agent,
        finalState!,
        'Let\'s switch gears. What was that timeline for practical quantum computers you mentioned earlier?'
    )) {
        if (event.type === 'response_output') {
            const response = event as any;
            if (response.message?.content) {
                console.log('\n' + response.message.content);
            }
        } else if (event.type === 'task_complete') {
            console.log('\n✅ Topic switch handled successfully!');
            console.log('\nMetaMemory automatically reactivated the relevant topic thread.');
        }
    }
}

// Run the example
main().catch(console.error);