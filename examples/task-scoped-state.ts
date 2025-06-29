/**
 * Task-Scoped State Example
 * 
 * This example demonstrates how state is now scoped per-task,
 * preventing interference between parallel or sequential tasks.
 */

import { runTask, InitialTaskState, TaskCompleteEvent, TaskFatalErrorEvent } from '../index.js';
import { Agent } from '@just-every/ensemble';

async function main() {
    console.log('🔄 Task-Scoped State Example\n');
    console.log('This demonstrates that each task has its own isolated state.\n');
    
    // Create two agents
    const agent1 = new Agent({
        name: 'TaskOne',
        modelClass: 'standard'
    });
    
    const agent2 = new Agent({
        name: 'TaskTwo',
        modelClass: 'standard'
    });
    
    // Different initial states for each task
    const state1: InitialTaskState = {
        metaFrequency: '5',
        thoughtDelay: '2'
    };
    
    const state2: InitialTaskState = {
        metaFrequency: '20',
        thoughtDelay: '0'
    };
    
    console.log('Running two tasks in parallel with different configurations:\n');
    console.log('Task 1: Meta every 5 requests, 2s thought delay');
    console.log('Task 2: Meta every 20 requests, no thought delay\n');
    
    // Run tasks in parallel
    const [result1, result2] = await Promise.all([
        runTaskAndCapture(agent1, 'Count from 1 to 3', state1),
        runTaskAndCapture(agent2, 'List three colors', state2)
    ]);
    
    console.log('\n📊 Results:');
    console.log('-'.repeat(50));
    console.log('Task 1 Result:', result1.result);
    console.log('Task 1 Final State:', result1.finalState);
    console.log();
    console.log('Task 2 Result:', result2.result);
    console.log('Task 2 Final State:', result2.finalState);
    
    console.log('\n✅ Notice how each task maintained its own state!');
    console.log('   - Different meta frequencies');
    console.log('   - Different thought delays');
    console.log('   - No interference between tasks');
}

async function runTaskAndCapture(agent: Agent, task: string, initialState?: InitialTaskState) {
    let result = '';
    let finalState: InitialTaskState | null = null;
    
    console.log(`\n🚀 Starting: ${task}`);
    
    for await (const event of runTask(agent, task, initialState)) {
        if (event.type === 'message_delta' && 'content' in event) {
            process.stdout.write(event.content);
        } else if (event.type === 'task_complete') {
            const completeEvent = event as TaskCompleteEvent;
            result = completeEvent.result || '';
            finalState = completeEvent.finalState || null;
            break;
        } else if (event.type === 'task_fatal_error') {
            const errorEvent = event as TaskFatalErrorEvent;
            console.error('\n❌ Task error:', errorEvent.result);
            finalState = errorEvent.finalState || null;
            break;
        }
    }
    
    return { result, finalState };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}