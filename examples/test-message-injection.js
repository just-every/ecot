import { Agent } from '@just-every/ensemble';
import { runTask, addMessageToTask } from '../dist/index.js';

// Simple test for message injection
async function testMessageInjection() {
    console.log('Testing message injection capability...\n');
    
    // Create a simple agent
    const agent = new Agent({
        name: 'TestAgent',
        modelClass: 'fast',
        instructions: 'You are a helpful assistant. When you receive developer messages, acknowledge them explicitly.'
    });
    
    // Create task
    const task = runTask(
        agent, 
        'Count from 1 to 5 slowly. After each number, wait for any developer guidance.'
    );
    
    // Schedule message injections
    setTimeout(() => {
        console.log('\n[TEST] Injecting developer message after 2 seconds...');
        addMessageToTask(task, {
            type: 'message',
            role: 'developer',
            content: 'DEVELOPER GUIDANCE: Please continue counting but add a fun fact about each number.'
        });
    }, 2000);
    
    setTimeout(() => {
        console.log('\n[TEST] Injecting another developer message after 5 seconds...');
        addMessageToTask(task, {
            type: 'message',
            role: 'developer', 
            content: 'DEVELOPER GUIDANCE: Great job! Now please finish up quickly.'
        });
    }, 5000);
    
    // Process the task events
    for await (const event of task) {
        if (event.type === 'message_delta' && event.content) {
            process.stdout.write(event.content);
        } else if (event.type === 'task_complete') {
            console.log('\n\n[TEST] Task completed successfully!');
            console.log('Result:', event.result);
            break;
        } else if (event.type === 'error') {
            console.error('\n[TEST] Error:', event.error);
            break;
        }
    }
}

// Run the test
testMessageInjection().catch(console.error);