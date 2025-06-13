#!/usr/bin/env node
import { Agent } from '@just-every/ensemble';
import { runTask, addMessageToTask } from '../dist/index.js';

/**
 * Demonstrates how to inject messages into a running task
 * This is useful for external systems that need to provide
 * guidance or updates to an agent while it's executing
 */

async function demonstrateMessageInjection() {
    // Create an agent
    const agent = new Agent({
        name: 'AnalysisAgent',
        modelClass: 'fast',
        instructions: 'You are analyzing a complex problem. Pay attention to developer messages for important updates.'
    });
    
    // Start the task
    const task = runTask(
        agent,
        'Please analyze the factors that contribute to successful software projects. Take your time and be thorough.'
    );
    
    // Simulate external system injecting messages at different times
    setTimeout(() => {
        console.log('\n[External System] Injecting guidance after 3 seconds...\n');
        addMessageToTask(task, {
            type: 'message',
            role: 'developer',
            content: 'IMPORTANT UPDATE: Please also consider the impact of remote work on team collaboration.'
        });
    }, 3000);
    
    setTimeout(() => {
        console.log('\n[External System] Injecting another update after 6 seconds...\n');
        addMessageToTask(task, {
            type: 'message',
            role: 'developer',
            content: 'STRATEGIC GUIDANCE: Focus on concrete examples from open-source projects.'
        });
    }, 6000);
    
    // Process the task
    console.log('Starting analysis task...\n');
    
    for await (const event of task) {
        if (event.type === 'message_delta' && event.content) {
            process.stdout.write(event.content);
        } else if (event.type === 'task_complete') {
            console.log('\n\n✅ Task completed successfully!');
            break;
        } else if (event.type === 'error') {
            console.error('\n\n❌ Error:', event.error);
            break;
        }
    }
}

// Run the demonstration
console.log('=== Message Injection Demo ===\n');
demonstrateMessageInjection().catch(console.error);