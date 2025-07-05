import { VectorSearchInterface, VectorSearchResult } from '../context/index.js';
import { TopicThread } from '../types/index.js';

/**
 * Simple in-memory vector search implementation
 * In production, replace with a proper vector database like Pinecone, Weaviate, etc.
 */
export class InMemoryVectorSearch implements VectorSearchInterface {
  private embeddings: Map<string, {
    topicName: string;
    summary: string;
    embedding: number[];
  }> = new Map();
  
  /**
   * Add or update a thread's embedding
   */
  async addThread(thread: TopicThread): Promise<void> {
    if (!thread.summary) return;
    
    // Generate a simple embedding (in production, use proper embedding model)
    const embedding = this.generateSimpleEmbedding(thread.summary);
    
    this.embeddings.set(thread.name, {
      topicName: thread.name,
      summary: thread.summary,
      embedding
    });
  }
  
  /**
   * Remove a thread's embedding
   */
  removeThread(topicName: string): void {
    this.embeddings.delete(topicName);
  }
  
  /**
   * Search for relevant threads
   */
  async search(query: string, topK: number): Promise<VectorSearchResult[]> {
    // Generate query embedding
    const queryEmbedding = this.generateSimpleEmbedding(query);
    
    // Calculate similarities
    const results: VectorSearchResult[] = [];
    
    for (const [_, data] of this.embeddings) {
      const similarity = this.cosineSimilarity(queryEmbedding, data.embedding);
      
      results.push({
        topicName: data.topicName,
        summary: data.summary,
        relevanceScore: similarity
      });
    }
    
    // Sort by relevance and return top K
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return results.slice(0, topK);
  }
  
  /**
   * Generate a simple embedding using character frequencies
   * In production, use a proper embedding model like OpenAI's ada-002
   */
  private generateSimpleEmbedding(text: string): number[] {
    const embedding = new Array(128).fill(0);
    const normalizedText = text.toLowerCase();
    
    // Simple character frequency embedding
    for (let i = 0; i < normalizedText.length; i++) {
      const charCode = normalizedText.charCodeAt(i);
      if (charCode >= 32 && charCode < 160) {
        embedding[charCode - 32] += 1;
      }
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }
    
    return embedding;
  }
  
  /**
   * Calculate cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
    }
    return dotProduct;
  }
  
  /**
   * Clear all embeddings
   */
  clear(): void {
    this.embeddings.clear();
  }
  
  /**
   * Get the number of indexed threads
   */
  size(): number {
    return this.embeddings.size;
  }
}

/**
 * Factory function to create a vector search instance
 * This allows easy swapping to different implementations
 */
export function createVectorSearch(): VectorSearchInterface {
  return new InMemoryVectorSearch();
}