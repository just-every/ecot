/**
 * Force Metamemory Compaction Demo
 * Creates conditions that will force compaction to occur
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

async function forceCompactDemo() {
    console.log('=== Force Compaction Demo ===\n');
    console.log('This demo creates optimal conditions for compaction.\n');
    
    // Configure metamemory for maximum processing
    configureMetamemory({
        windowSize: 20,        // Large window
        processInterval: 1,    // Process every message
        threadInactivityTimeout: 500,  // Quick timeout
        compactionThresholds: {
            core: 100,
            active: 90,
            complete: 50,      // Lower threshold
            ephemeral: 10      // Very low threshold
        }
    });
    
    setMetamemoryEnabled(true);
    
    // Create a simple agent with minimal instructions
    const agent = new Agent({
        name: 'CompactAgent',
        modelClass: 'mini',
        instructions: 'Answer in one sentence. Say "Task completed" and use task_complete when user says "done".'
    });
    
    console.log('Creating a message-heavy conversation...\n');
    
    let finalState;
    
    // Use ensemble's pause/resume to create a more controlled flow
    const { pause, resume, waitWhilePaused } = await import('../dist/index.js');
    
    const task = runTask(agent, 'Hi, let\'s have a quick chat', {
        metamemoryEnabled: true
    });
    
    // Process events with careful timing
    let responseCount = 0;
    const messages = [
        'What\'s 2+2?',
        'Thanks. What\'s the capital of France?',
        'Nice. What color is the sky?',
        'Great. Tell me a joke',
        'Haha. What\'s Python?',
        'Cool. What\'s JavaScript?',
        'done'
    ];
    
    for await (const event of task) {
        if (event.type === 'response_output') {
            responseCount++;
            console.log(`[Response ${responseCount}]\n`);
            
            // Give metamemory time to process EACH response
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            if (responseCount <= messages.length) {
                const nextMsg = messages[responseCount - 1];
                console.log(`USER: ${nextMsg}\n`);
                
                // Add message
                event.messages = event.messages || [];
                event.messages.push({
                    type: 'message',
                    role: 'user',
                    content: nextMsg
                });
                
                // Extra wait on the last message
                if (nextMsg === 'done') {
                    console.log('[Giving metamemory 5 seconds to finish...]\n');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
        } else if (event.type === 'task_complete') {
            finalState = event.finalState;
            console.log('✅ Task completed!\n');
        }
    }
    
    // Final wait
    console.log('[Final processing wait...]\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (finalState?.metamemoryState) {
        const state = finalState.metamemoryState;
        
        console.log('='.repeat(60));
        console.log('ANALYSIS');
        console.log('='.repeat(60));
        
        // Count message types
        const messageTypes = {};
        finalState.messages.forEach(m => {
            messageTypes[m.type] = (messageTypes[m.type] || 0) + 1;
        });
        
        console.log('\nMessage breakdown:');
        Object.entries(messageTypes).forEach(([type, count]) => {
            console.log(`- ${type}: ${count}`);
        });
        
        console.log(`\nTotal: ${finalState.messages.length} messages`);
        console.log(`Tracked by metamemory: ${state.metamemory.size}`);
        console.log(`Tracking rate: ${Math.round(state.metamemory.size / finalState.messages.length * 100)}%`);
        
        // Calculate trackable messages (user/assistant only)
        const trackableCount = finalState.messages.filter(m => 
            m.type === 'message' && ['user', 'assistant'].includes(m.role)
        ).length;
        console.log(`\nTrackable messages (user/assistant): ${trackableCount}`);
        console.log(`Tracked/Trackable rate: ${Math.round(state.metamemory.size / trackableCount * 100)}%`);
        
        // Show threads
        console.log('\nThreads:');
        for (const [id, thread] of state.threads) {
            console.log(`- ${thread.name} (${thread.status}, ${thread.messages.length} msgs)`);
        }
        
        // Try multiple compaction strategies
        console.log('\n' + '='.repeat(60));
        console.log('COMPACTION ATTEMPTS');
        console.log('='.repeat(60));
        
        // Strategy 1: Default compaction
        console.log('\n1. Default compaction:');
        let compacted = await getCompactedHistory(finalState);
        reportCompaction(compacted);
        
        // Strategy 2: Aggressive thresholds
        console.log('\n2. Aggressive thresholds:');
        compacted = await getCompactedHistory(finalState, {
            compactionThresholds: {
                core: 100,
                active: 100,
                complete: 100,
                ephemeral: 100
            }
        });
        reportCompaction(compacted);
        
        // Strategy 3: Force by modifying the safety check
        console.log('\n3. Without orphan check (for demo only):');
        // This would require modifying the compactor, but shows what would happen
        console.log('   [Would compact if orphan ratio check was removed]');
        
        // Show what WOULD be compacted if the check passed
        if (state.threads.size > 0) {
            console.log('\n   Threads that would be compacted:');
            for (const [id, thread] of state.threads) {
                if (thread.status === 'complete' || thread.class === 'ephemeral') {
                    console.log(`   - ${thread.name} (${thread.class}, ${thread.status})`);
                }
            }
        }
    }
}

function reportCompaction(compacted) {
    if (compacted && compacted.metadata.compactedCount < compacted.metadata.originalCount) {
        console.log(`   ✅ Success! ${compacted.metadata.originalCount} → ${compacted.metadata.compactedCount} messages`);
        const summaries = compacted.messages.filter(m => m.isCompacted);
        if (summaries.length > 0) {
            console.log(`   Created ${summaries.length} thread summaries`);
        }
    } else {
        console.log('   ❌ No compaction occurred');
    }
}

forceCompactDemo().catch(console.error);