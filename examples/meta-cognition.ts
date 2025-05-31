/**
 * Meta-cognition Example
 * 
 * This example demonstrates MECH's meta-cognition capabilities,
 * including model rotation and self-reflection.
 * 
 * MECH now handles all LLM communication internally through @just-every/ensemble,
 * automatically rotating between models and tracking performance.
 */

import { runMECH } from '../simple.js';
import { mechState, setMetaFrequency, getModelScore } from '../mech_state.js';
import type { RunMechOptions } from '../types.js';

async function main() {
    console.log('🧠 Meta-cognition Example\n');
    console.log('Note: This example requires API keys to be configured in your environment.\n');
    
    // Track model usage through status callbacks
    let llmCallCount = 0;
    const modelUsage = new Map<string, number>();
    
    try {
        // Set meta-cognition to trigger frequently for demo
        console.log('Setting meta-cognition frequency to 5 (every 5 LLM calls)\n');
        setMetaFrequency('5');
        
        // Run multiple tasks to trigger meta-cognition
        const tasks = [
            'Explain quantum computing',
            'Solve a logic puzzle',
            'Write a haiku about AI',
            'Calculate fibonacci sequence',
            'Explain machine learning',
            'Debug a Python function',
            'Design a REST API',
            'Optimize an algorithm'
        ];
        
        console.log('Running multiple tasks to demonstrate meta-cognition...');
        console.log('ℹ️  MECH will automatically:');
        console.log('   • Rotate between available models');
        console.log('   • Track model performance');
        console.log('   • Trigger meta-cognition analysis');
        console.log('   • Adjust model scores based on performance\n');
        
        for (const task of tasks) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`TASK: ${task}`);
            console.log('='.repeat(60));
            
            const options: RunMechOptions = {
                agent: {
                    name: 'MetaBot',
                    modelClass: 'reasoning',
                    instructions: 'You are a reasoning agent that solves complex problems.'
                },
                task: task,
                onStatus: (status) => {
                    if (status.type === 'meta_cognition_triggered') {
                        console.log('\n🔄 META-COGNITION TRIGGERED');
                        console.log(`   Frequency: Every ${mechState.metaFrequency} calls`);
                    } else if (status.type === 'model_selected') {
                        llmCallCount++;
                        const model = (status as any).model || 'unknown';
                        modelUsage.set(model, (modelUsage.get(model) || 0) + 1);
                        console.log(`\n🤖 LLM Call #${llmCallCount}`);
                        console.log(`   Model: ${model}`);
                        console.log(`   Score: ${getModelScore(model, 'reasoning')}`);
                    }
                },
                onHistory: (item) => {
                    if (item.type === 'thinking') {
                        console.log('💭 Thinking:', item.content?.toString().substring(0, 60) + '...');
                    }
                }
            };
            
            const result = await runMECH(options);
            
            console.log(`\n✅ Task completed: ${result.status}`);
            console.log(`   Duration: ${result.durationSec}s`);
        }
        
        // Show model usage statistics
        console.log('\n\n📊 Model Usage Statistics:');
        console.log('-'.repeat(50));
        console.log(`Total LLM calls: ${llmCallCount}`);
        console.log(`Meta-cognition triggers: ${Math.floor(llmCallCount / mechState.metaFrequency)}`);
        console.log('\nModel distribution:');
        
        for (const [model, count] of modelUsage.entries()) {
            const percentage = ((count / llmCallCount) * 100).toFixed(1);
            console.log(`  ${model}: ${count} calls (${percentage}%)`);
        }
        
        console.log('\n💡 Key Features Demonstrated:');
        console.log('   • Automatic model rotation prevents over-reliance on single model');
        console.log('   • Meta-cognition analyzes performance every N requests');
        console.log('   • Model scores adjust based on observed performance');
        console.log('   • Failed models are temporarily disabled');
        
    } catch (error) {
        console.error('❌ Error:', error);
        console.log('\n🔧 Common issues:');
        console.log('   • Ensure API keys are set in your environment');
        console.log('   • Check that @just-every/ensemble is properly installed');
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}