/**
 * Resume Task Example
 * 
 * This example demonstrates how to pause a task and resume it later
 * with full conversation history and state preservation.
 */

import { runTask, resumeTask, TaskCompleteEvent, TaskFatalErrorEvent } from '../index.js';
import { Agent } from '@just-every/ensemble';

async function main() {
    console.log('🔄 Task Resumption Example\n');
    console.log('This demonstrates pausing and resuming tasks with full state.\n');
    
    const agent = new Agent({
        name: 'ResumableAssistant',
        modelClass: 'reasoning',
        instructions: 'You are a helpful assistant that can work on multi-part tasks'
    });
    
    // Phase 1: Start a task
    console.log('📝 Phase 1: Starting initial analysis...\n');
    
    let finalState: TaskCompleteEvent['finalState'] | null = null;
    
    for await (const event of runTask(agent, 'Analyze the security implications of using eval() in JavaScript. Start with the basic risks.')) {
        if (event.type === 'message_delta' && 'content' in event) {
            process.stdout.write(event.content);
        } else if (event.type === 'task_complete') {
            finalState = event.finalState;
            console.log('\n\n✅ Phase 1 complete!');
            console.log(`Messages in history: ${finalState.messages.length}`);
            console.log(`Current meta frequency: ${finalState.metaFrequency}`);
            break;
        } else if (event.type === 'task_fatal_error') {
            console.error('\n❌ Error:', event.result);
            finalState = event.finalState;
            break;
        }
    }
    
    if (!finalState) {
        console.error('No final state received!');
        return;
    }
    
    // Simulate a pause (in real use, this could be hours/days later)
    console.log('\n⏸️  Simulating pause... (in practice, save finalState to database)\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Phase 2: Resume with additional instructions
    console.log('▶️  Phase 2: Resuming with additional analysis...\n');
    
    for await (const event of resumeTask(agent, finalState, 'Now analyze the safe alternatives to eval() and provide code examples.')) {
        if (event.type === 'message_delta' && 'content' in event) {
            process.stdout.write(event.content);
        } else if (event.type === 'task_complete') {
            finalState = event.finalState;
            console.log('\n\n✅ Phase 2 complete!');
            console.log(`Total messages: ${finalState.messages.length}`);
            break;
        }
    }
    
    // Phase 3: Resume without new content (continue previous work)
    console.log('\n▶️  Phase 3: Continuing without new instructions...\n');
    
    for await (const event of resumeTask(agent, finalState)) {
        if (event.type === 'message_delta' && 'content' in event) {
            process.stdout.write(event.content);
        } else if (event.type === 'task_complete') {
            console.log('\n\n✅ All phases complete!');
            console.log('\n📊 Final Statistics:');
            console.log(`- Total messages: ${event.finalState.messages.length}`);
            console.log(`- Meta frequency: ${event.finalState.metaFrequency}`);
            console.log(`- Thought delay: ${event.finalState.thoughtDelay}s`);
            console.log(`- Model scores:`, event.finalState.modelScores);
            break;
        }
    }
    
    console.log('\n💡 Key Benefits:');
    console.log('- Full conversation history preserved across sessions');
    console.log('- Model performance data maintained');
    console.log('- Can pause/resume complex multi-step tasks');
    console.log('- Perfect for long-running analysis or research');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}