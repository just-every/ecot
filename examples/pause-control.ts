/**
 * Pause Control Example
 * 
 * This example demonstrates how to use ensemble's pause functionality with MECH.
 * Shows how to pause/resume LLM requests and listen to pause events.
 */

import { runMECH, pause, resume, isPaused, getPauseController } from '../index.js';
import { Agent } from '@just-every/ensemble';

async function main() {
    console.log('⏸️  MECH Pause Control Example\n');
    
    // Set up pause event listeners
    const controller = getPauseController();
    controller.on('paused', () => console.log('🔴 System paused!'));
    controller.on('resumed', () => console.log('🟢 System resumed!'));
    
    // Create agent
    const agent = new Agent({
        name: 'PauseBot',
        instructions: 'You are a helpful assistant. Take your time to think through problems step by step.',
        modelClass: 'reasoning'
    });
    
    const task = 'Count from 1 to 10, but explain what each number represents in different contexts (math, time, sports, etc.)';
    
    try {
        console.log('Starting MECH with pause control...\n');
        
        // Start the MECH process
        const mechGenerator = runMECH(agent, task);
        
        // Set up automatic pause/resume for demonstration
        setTimeout(() => {
            console.log('\n📢 Pausing system in 3 seconds...');
            setTimeout(() => {
                if (!isPaused()) {
                    pause();
                    console.log('⏸️  Paused! Notice how MECH waits between iterations.');
                    
                    // Resume after 5 seconds
                    setTimeout(() => {
                        console.log('📢 Resuming system...');
                        resume();
                    }, 5000);
                }
            }, 3000);
        }, 2000);
        
        let eventCount = 0;
        
        for await (const event of mechGenerator) {
            eventCount++;
            
            // Show message content
            if (event.type === 'message_delta' && 'content' in event) {
                process.stdout.write(event.content);
            }
            
            // Show when we're starting new thoughts (to see pause effects)
            if (event.type === 'response_start') {
                console.log(`\n💭 [${new Date().toLocaleTimeString()}] Starting new thought...`);
            }
            
            // Handle completion
            if (event.type === 'tool_done' && 'tool_call' in event) {
                const toolEvent = event as any;
                if (toolEvent.tool_call?.function?.name === 'task_complete') {
                    console.log('\n\n✅ Task completed!');
                    console.log(`Total events processed: ${eventCount}`);
                    console.log(`Final pause state: ${isPaused() ? 'Paused' : 'Running'}`);
                    break;
                }
            }
            
            // Show pause state periodically
            if (eventCount % 10 === 0) {
                console.log(`\n📊 [Status] Events: ${eventCount}, Paused: ${isPaused()}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
    
    console.log('\n📋 Summary:');
    console.log('- MECH automatically waits when ensemble is paused');
    console.log('- No additional pause logic needed in MECH');
    console.log('- Pause state is managed globally by ensemble');
    console.log('- Events continue normally after resume');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}