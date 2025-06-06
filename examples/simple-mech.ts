/**
 * Simple MECH Example
 * 
 * This example shows the simplest way to use MECH with minimal setup.
 * MECH now handles LLM communication internally through the @just-every/ensemble package.
 */

import { runMECH } from '../index.js';
import { Agent } from '@just-every/ensemble';

async function main() {
    console.log('🤖 Simple MECH Example\n');
    console.log('Note: This example requires API keys to be configured in your environment.\n');
    
    // Create agent using ensemble's Agent class
    const agent = new Agent({
        name: 'SimpleBot',
        instructions: 'You are a helpful assistant that provides clear, concise answers.',
        modelClass: 'reasoning'
    });
    
    const task = 'What is the meaning of life?';
    
    try {
        console.log('Starting MECH...\n');
        console.log('ℹ️  MECH will automatically handle:');
        console.log('   • LLM selection and rotation');
        console.log('   • Model performance tracking');
        console.log('   • Meta-cognition');
        console.log('   • Thought management\n');
        
        let startTime = Date.now();
        let completionResult = '';
        
        for await (const event of runMECH(agent, task)) {
            // Handle different event types
            if (event.type === 'message_delta' && 'content' in event) {
                process.stdout.write(event.content);
            } else if (event.type === 'tool_done' && 'tool_call' in event) {
                const toolEvent = event as any;
                if (toolEvent.tool_call?.function?.name === 'task_complete') {
                    completionResult = toolEvent.result?.output || 'Task completed';
                }
            }
        }
        
        const duration = (Date.now() - startTime) / 1000;
        
        console.log('\n\n✅ MECH Execution Complete:');
        console.log('-'.repeat(50));
        console.log(`Duration: ${duration.toFixed(2)}s`);
        
        if (completionResult) {
            console.log(`\n📌 Final Result:\n${completionResult}`);
        }
        
        console.log('\n💡 Tips:');
        console.log('   • Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY in your environment');
        console.log('   • MECH will automatically select the best available model');
        console.log('   • The async generator yields all events for real-time processing');
        
    } catch (error) {
        console.error('❌ Error:', error);
        console.log('\n🔧 Common issues:');
        console.log('   • Ensure API keys are set in your environment');
        console.log('   • Check that @just-every/ensemble is properly installed');
        console.log('   • Verify network connectivity to LLM providers');
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}