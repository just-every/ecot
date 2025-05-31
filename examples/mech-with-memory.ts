/**
 * 🧠 MECH Memory Integration Example
 * 
 * This example demonstrates how to use MECH with memory features for context-aware
 * task execution. It shows practical patterns for building AI systems that remember
 * and learn from previous interactions.
 * 
 * MECH now handles LLM communication internally through the @just-every/ensemble package,
 * so you only need to provide memory functions for embedding and storage.
 */

import { runMECH, getTotalCost, resetCostTracker } from '../simple.js';
import type { RunMechOptions, MemoryItem } from '../types.js';

// 💾 Simulate a Vector Database
class MockVectorDB {
    private memories: Array<{
        id: string;
        text: string;
        embedding: number[];
        metadata: Record<string, any>;
        timestamp: Date;
    }> = [];

    async store(text: string, embedding: number[], metadata: Record<string, any> = {}): Promise<string> {
        const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.memories.push({
            id,
            text,
            embedding,
            metadata,
            timestamp: new Date()
        });
        console.log(`📝 Stored memory: "${text.substring(0, 50)}..."`);
        return id;
    }

    async search(queryEmbedding: number[], topK: number = 5): Promise<MemoryItem[]> {
        // Simulate cosine similarity search
        const similarities = this.memories.map(memory => {
            // Simple dot product for similarity (in real systems, use proper cosine similarity)
            const similarity = memory.embedding.reduce((sum, val, i) => 
                sum + val * queryEmbedding[i], 0
            ) / (memory.embedding.length);
            
            return {
                memory,
                similarity: Math.abs(similarity) + Math.random() * 0.1 // Add some randomness for demo
            };
        });

        // Sort by similarity and return top K
        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK)
            .map(item => ({
                text: item.memory.text,
                metadata: {
                    ...item.memory.metadata,
                    similarity: item.similarity,
                    id: item.memory.id,
                    timestamp: item.memory.timestamp
                }
            }));
    }

    getStats() {
        return {
            totalMemories: this.memories.length,
            memoryTypes: [...new Set(this.memories.map(m => m.metadata.type || 'general'))]
        };
    }
}

// 🔧 Mock Embedding Service
class MockEmbeddingService {
    private cache = new Map<string, number[]>();

    async generateEmbedding(text: string): Promise<number[]> {
        // Check cache first
        if (this.cache.has(text)) {
            console.log(`🎯 Cache hit for embedding: ${text.substring(0, 30)}...`);
            return this.cache.get(text)!;
        }

        console.log(`🧠 Generating embedding for: ${text.substring(0, 30)}...`);
        
        // Simulate embedding generation with consistent results for same text
        const hash = this.simpleHash(text);
        const embedding = Array.from({length: 1536}, (_, i) => 
            Math.sin(hash + i) * Math.cos(hash * i) * 0.5
        );
        
        this.cache.set(text, embedding);
        return embedding;
    }

    private simpleHash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    }

    getCacheStats() {
        return {
            cacheSize: this.cache.size,
            cacheKeys: Array.from(this.cache.keys()).map(k => k.substring(0, 30))
        };
    }
}

// 🎯 Example 1: Personal Knowledge Assistant
async function personalKnowledgeAssistant() {
    console.log('🧠 === Personal Knowledge Assistant ===');
    
    const vectorDB = new MockVectorDB();
    const embeddingService = new MockEmbeddingService();
    
    // Pre-populate with some knowledge
    const initialKnowledge = [
        { text: "TypeScript is a statically typed superset of JavaScript", type: "programming" },
        { text: "React 18 introduced concurrent features and automatic batching", type: "programming" },
        { text: "The capital of France is Paris, known for the Eiffel Tower", type: "geography" },
        { text: "Machine learning uses algorithms to find patterns in data", type: "ai" },
        { text: "The mitochondria is the powerhouse of the cell", type: "biology" }
    ];
    
    for (const knowledge of initialKnowledge) {
        const embedding = await embeddingService.generateEmbedding(knowledge.text);
        await vectorDB.store(knowledge.text, embedding, { type: knowledge.type });
    }
    
    const queries = [
        "What do you know about TypeScript?",
        "Tell me about React",
        "What's the capital of France?",
        "Explain machine learning",
        "Teach me about cells in biology"
    ];
    
    for (const query of queries) {
        console.log(`\\n👤 Query: ${query}`);
        console.log('🤖 MECH is processing with automatic LLM selection...');
        
        const result = await runMECH({
            agent: { 
                name: 'KnowledgeBot',
                instructions: 'You are a knowledgeable assistant. Use retrieved memories to provide accurate, contextual answers.'
            },
            task: query,
            
            // Memory integration
            embed: embeddingService.generateEmbedding.bind(embeddingService),
            
            lookupMemories: async (embedding) => {
                console.log('🔍 Searching knowledge base...');
                const results = await vectorDB.search(embedding, 3);
                console.log(`📚 Found ${results.length} relevant memories`);
                return results;
            },
            
            saveMemory: async (taskId, memories) => {
                console.log(`💾 Saving ${memories.length} new memories...`);
                for (const memory of memories) {
                    const embedding = await embeddingService.generateEmbedding(memory.text);
                    await vectorDB.store(memory.text, embedding, {
                        taskId,
                        learned: true,
                        ...memory.metadata
                    });
                }
            }
        });
        
        console.log(`✅ Response: ${result.mechOutcome?.result}`);
    }
    
    console.log('\\n📊 Knowledge Base Stats:', vectorDB.getStats());
}

// 🎓 Example 2: Learning Conversation Agent
async function learningConversationAgent() {
    console.log('\\n🎓 === Learning Conversation Agent ===');
    
    const vectorDB = new MockVectorDB();
    const embeddingService = new MockEmbeddingService();
    
    const conversation = [
        "Hi, I'm working on a React project",
        "I need help with state management",
        "Should I use Redux or Context API?",
        "What about for a large application?",
        "Thanks! Can you remember my preference for future reference?"
    ];
    
    console.log('🗣️ Simulating a learning conversation...');
    
    for (const [index, userMessage] of conversation.entries()) {
        console.log(`\\n👤 User (${index + 1}/${conversation.length}): ${userMessage}`);
        console.log('🤖 MECH is processing conversation...');
        
        const result = await runMECH({
            agent: { 
                name: 'LearningBot',
                instructions: 'You are a helpful coding assistant that learns user preferences and provides personalized advice. Remember important details about the user\'s projects and preferences.'
            },
            task: userMessage,
            
            embed: embeddingService.generateEmbedding.bind(embeddingService),
            
            lookupMemories: async (embedding) => {
                return await vectorDB.search(embedding, 2);
            },
            
            saveMemory: async (taskId, memories) => {
                for (const memory of memories) {
                    const embedding = await embeddingService.generateEmbedding(memory.text);
                    await vectorDB.store(memory.text, embedding, {
                        taskId,
                        conversationIndex: index,
                        topic: 'react_development',
                        userPreference: input.includes('preference'),
                        ...memory.metadata
                    });
                }
            }
        });
        
        console.log(`🤖 Response: ${result.mechOutcome?.result}`);
        
        // Simulate user preference learning
        if (input.includes('preference')) {
            const prefEmbedding = await embeddingService.generateEmbedding(
                "User prefers Redux Toolkit for large React applications with complex state management"
            );
            await vectorDB.store(
                "User prefers Redux Toolkit for large React applications",
                prefEmbedding,
                { type: 'user_preference', technology: 'react', category: 'state_management' }
            );
        }
    }
    
    console.log('\\n📈 Conversation Learning Stats:', vectorDB.getStats());
}

// 🔬 Example 3: Research Assistant with Domain Expertise
async function domainExpertResearcher() {
    console.log('\\n🔬 === Domain Expert Researcher ===');
    
    const vectorDB = new MockVectorDB();
    const embeddingService = new MockEmbeddingService();
    
    // Populate with domain expertise
    const expertKnowledge = [
        { 
            text: "Large Language Models like GPT-4 and Claude use transformer architecture with attention mechanisms",
            domain: "ai",
            complexity: "advanced"
        },
        { 
            text: "Vector databases enable semantic search by storing high-dimensional embeddings of text",
            domain: "ai", 
            complexity: "intermediate"
        },
        { 
            text: "Retrieval Augmented Generation (RAG) combines retrieval systems with generative models",
            domain: "ai",
            complexity: "advanced"
        },
        { 
            text: "Fine-tuning adapts pre-trained models to specific tasks or domains",
            domain: "ai",
            complexity: "intermediate"
        }
    ];
    
    for (const knowledge of expertKnowledge) {
        const embedding = await embeddingService.generateEmbedding(knowledge.text);
        await vectorDB.store(knowledge.text, embedding, knowledge);
    }
    
    const researchQuery = "How can I build a system that retrieves relevant information and generates contextual responses?";
    console.log(`\\n🔍 Research Query: ${researchQuery}`);
    console.log('🤖 MECH is analyzing with domain expertise...');
    
    const result = await runMECH({
        agent: { 
            name: 'DomainExpert',
            instructions: 'You are an AI research expert. Provide comprehensive, technically accurate answers using relevant research and examples. When memories are provided, integrate them into your analysis.'
        },
        task: researchQuery,
        
        embed: embeddingService.generateEmbedding.bind(embeddingService),
        
        lookupMemories: async (embedding) => {
            console.log('🎯 Searching domain expertise...');
            const results = await vectorDB.search(embedding, 4);
            console.log(`📖 Retrieved ${results.length} expert insights`);
            return results;
        },
        
        saveMemory: async (taskId, memories) => {
            console.log(`📚 Expanding knowledge base with research insights...`);
            for (const memory of memories) {
                const embedding = await embeddingService.generateEmbedding(memory.text);
                await vectorDB.store(memory.text, embedding, {
                    taskId,
                    source: 'research_session',
                    domain: 'ai_systems',
                    complexity: 'expert',
                    ...memory.metadata
                });
            }
        }
    });
    
    console.log('✅ Research Complete!');
    console.log('📋 Findings:\\n', result.mechOutcome?.result);
    
    console.log('\\n🧠 Expert Knowledge Stats:', vectorDB.getStats());
    console.log('🎯 Embedding Cache Stats:', embeddingService.getCacheStats());
}

// 📊 Run all memory examples
async function runMemoryExamples() {
    console.log('🧠 MECH Memory Integration Examples Starting...\\n');
    
    resetCostTracker();
    
    try {
        await personalKnowledgeAssistant();
        await learningConversationAgent();
        await domainExpertResearcher();
        
        console.log('\\n💰 === Memory Examples Cost Summary ===');
        const totalCost = getTotalCost();
        console.log(`Total cost: $${totalCost.toFixed(6)}`);
        
        if (totalCost === 0) {
            console.log('ℹ️  Note: If cost is $0, ensure API keys are configured in your environment');
            console.log('🔗 MECH integrates with OpenAI, Anthropic, Google, and other providers via @just-every/ensemble');
        }
        
        console.log('\\n🎉 Memory integration examples completed!');
        console.log('\\n💡 Key Takeaways:');
        console.log('   • Memory enables context-aware conversations');
        console.log('   • Vector similarity search finds relevant information');
        console.log('   • Embedding caching improves performance');
        console.log('   • Domain expertise can be built incrementally');
        console.log('   • User preferences can be learned and applied');
        
        console.log('\\n🛠️  Production Tips:');
        console.log('   • Use proper vector databases (Pinecone, Weaviate)');
        console.log('   • Implement embedding caching strategies');
        console.log('   • Monitor memory storage costs');
        console.log('   • Set up memory cleanup policies');
        console.log('   • Consider hybrid search approaches');
        console.log('   • Configure API keys: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY');
        
    } catch (error) {
        console.error('❌ Error in memory examples:', error);
        console.log('\\n🔧 Common memory integration issues:');
        console.log('   • Embedding service rate limits');
        console.log('   • Vector database connection issues');
        console.log('   • Memory storage capacity limits');
        console.log('   • Inconsistent embedding dimensions');
    }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runMemoryExamples();
}