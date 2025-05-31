/**
 * Simple MECH Example
 * 
 * This example shows the simplest way to use MECH with minimal setup.
 * MECH now handles LLM communication internally through the @just-every/ensemble package.
 */

import { runMECH } from '../simple.js';
import type { RunMechOptions } from '../types.js';

async function main() {
    console.log('🤖 Simple MECH Example\n');
    console.log('Note: This example requires API keys to be configured in your environment.\n');
    
    // Configure MECH with minimal options
    const options: RunMechOptions = {
        agent: {
            name: 'SimpleBot',
            instructions: 'You are a helpful assistant that provides clear, concise answers.'
        },
        task: 'What is the meaning of life?',
        onHistory: (item) => {
            console.log('\n📝 History:', item.type, item.role || '');
        },
        onStatus: (status) => {
            console.log('\n📊 Status:', status.type);
        }
    };
    
    try {
        console.log('Starting MECH...\n');
        console.log('ℹ️  MECH will automatically handle:');
        console.log('   • LLM selection and rotation');
        console.log('   • Model performance tracking');
        console.log('   • Cost monitoring');
        console.log('   • Thought management\n');
        
        const result = await runMECH(options);
        
        console.log('\n\n✅ MECH Result:');
        console.log('-'.repeat(50));
        console.log(`Status: ${result.status}`);
        console.log(`Duration: ${result.durationSec}s`);
        console.log(`Total Cost: $${result.totalCost.toFixed(4)}`);
        console.log(`History items: ${result.history.length}`);
        
        if (result.mechOutcome?.result) {
            console.log(`\n📌 Final Result:\n${result.mechOutcome.result}`);
        }
        
        console.log('\n💡 Tips:');
        console.log('   • Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY in your environment');
        console.log('   • MECH will automatically select the best available model');
        console.log('   • Use the onHistory callback to see the agent\'s thought process');
        
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