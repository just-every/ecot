/**
 * Show complete metamemory state as JSON
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

config();

async function showMetamemoryJSON() {
    console.log('=== Metamemory State JSON Export ===\n');
    
    // Configure metamemory with aggressive settings
    configureMetamemory({
        windowSize: 20,
        processInterval: 1, // Process every message
        threadInactivityTimeout: 500
    });
    
    setMetamemoryEnabled(true);
    
    const agent = new Agent({
        name: 'JSONExportAgent',
        modelClass: 'mini',
        instructions: 'Answer questions briefly. When user says "done", use task_complete tool.'
    });
    
    let finalState;
    const task = runTask(agent, 'What is recursion?', {
        metamemoryEnabled: true
    });
    
    // Properly add messages
    setTimeout(() => addMessageToTask(task, {
        type: 'message',
        role: 'user',
        content: 'Now explain closures in JavaScript'
    }), 2000);
    
    setTimeout(() => addMessageToTask(task, {
        type: 'message',
        role: 'user',
        content: 'What about REST APIs?'
    }), 4000);
    
    setTimeout(() => addMessageToTask(task, {
        type: 'message',
        role: 'user',
        content: 'done'
    }), 6000);
    
    // Process events
    for await (const event of task) {
        if (event.type === 'task_complete') {
            finalState = event.finalState;
        }
    }
    
    // Wait for all processing
    console.log('Waiting for metamemory processing...\n');
    await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds
    
    // Force a final check
    console.log('Processing state:', finalState?.metamemoryProcessing);
    
    if (finalState?.metamemoryState) {
        // Convert Maps to objects for JSON serialization
        const metamemoryObj = {};
        for (const [k, v] of finalState.metamemoryState.metamemory) {
            metamemoryObj[k] = v;
        }
        
        const threadsObj = {};
        for (const [k, v] of finalState.metamemoryState.threads) {
            threadsObj[k] = v;
        }
        
        const stateJSON = {
            metamemory: metamemoryObj,
            threads: threadsObj,
            lastProcessedIndex: finalState.metamemoryState.lastProcessedIndex,
            lastProcessedTime: new Date(finalState.metamemoryState.lastProcessedTime).toISOString(),
            totalMessages: finalState.messages.length,
            messagesSummary: finalState.messages.map(m => ({
                type: m.type,
                role: m.role,
                id: m.id || 'NO_ID',
                contentLength: m.content ? m.content.length : 0
            }))
        };
        
        console.log('METAMEMORY STATE JSON:');
        console.log(JSON.stringify(stateJSON, null, 2));
        
        // Also show compaction
        console.log('\n\nCOMPACTION RESULT:');
        const compacted = await getCompactedHistory(finalState);
        console.log(`Original: ${compacted.metadata.originalCount} messages`);
        console.log(`Compacted: ${compacted.metadata.compactedCount} messages`);
        console.log('Compacted content:');
        compacted.messages.forEach((msg, i) => {
            console.log(`${i + 1}. [${msg.role}${msg.isCompacted ? ' COMPACTED' : ''}]: ${msg.content}`);
        });
    }
}

showMetamemoryJSON().catch(console.error);