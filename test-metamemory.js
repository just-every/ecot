#!/usr/bin/env node
/**
 * Test the new metamemory implementation
 */

import { Agent } from '@just-every/ensemble';
import { runTask } from './dist/index.js';
import { setMetamemoryEnabled, configureMetamemory } from './dist/src/state/state.js';

async function testMetamemory() {
    console.log('🧠 Testing new metamemory implementation...\n');
    
    // Enable metamemory
    setMetamemoryEnabled(true);
    
    // Configure metamemory
    configureMetamemory({
        maxTokensPerActiveThread: 1000,
        maxTokensPerIdleThread: 500,
        inactivityThresholdMinutes: {
            activeToIdle: 1,
            idleToArchived: 5
        },
        slidingWindowSize: 10,
        compactionInterval: 5000
    });
    
    // Create an agent
    const agent = new Agent({ 
        name: 'TestAgent',
        modelClass: 'standard',
        instructions: 'You are a helpful assistant. Use the task_complete tool when done.'
    });
    
    console.log('Running task with metamemory enabled...\n');
    
    // Run a task
    for await (const event of runTask(agent, 'Count from 1 to 10 slowly, explaining each number. Then tell me about prime numbers between 1 and 10.')) {
        if (event.type === 'response_output') {
            const response = event;
            if (response.message?.content) {
                console.log('Assistant:', response.message.content);
            }
        } else if (event.type === 'task_complete') {
            console.log('\n✅ Task completed!');
            console.log('Final state metamemory:', event.finalState.metamemoryState ? 'Enabled' : 'Disabled');
            
            if (event.finalState.metamemoryState) {
                const state = event.finalState.metamemoryState;
                console.log(`- Threads: ${state.threads.size}`);
                console.log(`- Last processed index: ${state.lastProcessedIndex}`);
                
                // List threads
                for (const [name, thread] of state.threads) {
                    console.log(`  - Thread "${name}": ${thread.messages.length} messages, status: ${thread.status}`);
                }
            }
        }
    }
}

// Run the test
testMetamemory().catch(console.error);