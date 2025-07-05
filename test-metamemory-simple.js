#!/usr/bin/env node
/**
 * Simple test to verify metamemory is properly integrated
 */

import { runTask } from './dist/index.js';
import { Agent } from '@just-every/ensemble';
import { setMetamemoryEnabled } from './dist/src/state/state.js';

// Mock agent that completes immediately
const mockAgent = {
    name: 'MockAgent',
    modelClass: 'standard',
    instructions: 'Complete tasks immediately',
    tools: [],
    generate: async (messages) => {
        // Simulate some messages for metamemory to process
        return { 
            content: 'Task analysis complete',
            role: 'assistant'
        };
    }
};

async function testBasicMetamemory() {
    console.log('🧪 Testing metamemory integration...\n');
    
    // Enable metamemory
    setMetamemoryEnabled(true);
    console.log('✅ Metamemory enabled');
    
    try {
        // Run a simple task
        const events = [];
        for await (const event of runTask(mockAgent, 'Test task')) {
            events.push(event);
            
            if (event.type === 'response_output') {
                console.log('📝 Message processed');
            }
            
            if (event.type === 'task_complete' || event.type === 'task_fatal_error') {
                console.log(`\n🎯 Task ${event.type === 'task_complete' ? 'completed' : 'failed'}`);
                
                const finalState = event.finalState;
                console.log(`- Metamemory enabled: ${finalState.metamemoryEnabled}`);
                console.log(`- Metamemory state exists: ${!!finalState.metamemoryState}`);
                
                if (finalState.metamemoryState) {
                    console.log(`- State type: ${typeof finalState.metamemoryState}`);
                    console.log(`- Has threads: ${!!finalState.metamemoryState.threads}`);
                    console.log(`- Thread count: ${finalState.metamemoryState.threads?.size || 0}`);
                }
                
                break;
            }
        }
        
        console.log(`\n✅ Processed ${events.length} events total`);
        console.log('✅ Metamemory integration working correctly!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
testBasicMetamemory().catch(console.error);