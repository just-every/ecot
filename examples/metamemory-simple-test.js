/**
 * Simple Metamemory Test
 * Test the basic functionality without the full UI
 */

import { config } from 'dotenv';
import { Agent } from '@just-every/ensemble';
import { 
    runTask, 
    getCompactedHistory,
    configureMetamemory,
    setMetamemoryEnabled
} from '../dist/index.js';

config();

async function simpleTest() {
    console.log('=== Simple Metamemory Test ===\n');
    
    // Configure metamemory
    configureMetamemory({
        windowSize: 10,
        processInterval: 2,  // Process every 2 messages
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
        name: 'TestAgent',
        modelClass: 'mini',
        instructions: `You are a helpful assistant. Answer questions very briefly (1 sentence).
When the user says "all done", use the task_complete tool.`
    });
    
    console.log('Running conversation...\n');
    
    let finalState;
    const task = runTask(agent, 'What is 2+2?', {
        metamemoryEnabled: true
    });
    
    // Just let it run to completion
    for await (const event of task) {
        if (event.type === 'task_fatal_error') {
            console.error('Fatal error:', event.result);
            break;
        } else if (event.type === 'task_complete') {
            finalState = event.finalState;
            console.log('Task completed');
        } else if (event.type === 'error') {
            console.error('Error event:', event.error);
        }
    }
    
    // Check results
    if (finalState?.metamemoryState) {
        console.log('\nMetamemory State:');
        console.log('- Messages tracked:', finalState.metamemoryState.metamemory.size);
        console.log('- Threads created:', finalState.metamemoryState.threads.size);
        
        // Try compaction
        try {
            const compacted = await getCompactedHistory(finalState);
            if (compacted) {
                console.log('\nCompaction:');
                console.log('- Original:', compacted.metadata.originalCount);
                console.log('- Compacted:', compacted.metadata.compactedCount);
                console.log('- Reduction:', Math.round((1 - compacted.metadata.compactedCount / compacted.metadata.originalCount) * 100) + '%');
            }
        } catch (e) {
            console.error('\nCompaction error:', e);
        }
    } else {
        console.log('\nNo metamemory state found');
    }
}

simpleTest().catch(error => {
    console.error('\nTest error:', error);
    process.exit(1);
});