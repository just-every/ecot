# Proactive High-Quality Thread Summaries - Todo List

## Overview
Yes, we can absolutely generate high-quality summaries proactively! This combines the timing aspect (proactive) with the quality aspect (rich summaries) into a single, efficient system.

## Implementation Tasks

### 🎯 Phase 1: Core Proactive Summarization (2-3 days)

#### 1.1 Add Summarization Queue System
- [ ] Create `SummarizationQueue` class in `src/metamemory/queue.ts`
- [ ] Track pending threads that need summarization
- [ ] Batch summarization requests for efficiency
- [ ] Add debouncing to avoid over-summarizing active threads

```typescript
interface SummarizationQueue {
  pending: Map<string, SummarizationRequest>;
  add(threadId: string, priority: 'high' | 'normal' | 'low'): void;
  processBatch(maxBatch: number): Promise<void>;
  cancel(threadId: string): void;
}
```

#### 1.2 Implement Proactive Triggers
- [ ] Trigger when thread reaches 5 messages
- [ ] Trigger on thread status change (active → complete)
- [ ] Trigger after inactivity timeout (configurable)
- [ ] Trigger on explicit user actions (e.g., "done with topic")

```typescript
// In processor.ts after updating thread
if (thread.messages.length === 5 && !thread.summary) {
  this.summarizationQueue.add(thread.id, 'normal');
} else if (thread.messages.length % 10 === 0) {
  // Re-summarize every 10 messages
  this.summarizationQueue.add(thread.id, 'low');
}
```

#### 1.3 Integrate ThreadSummarizer
- [ ] Connect summarizer to processor
- [ ] Run summarization in background
- [ ] Update thread state with summaries
- [ ] Handle summarization failures gracefully

### 🚀 Phase 2: Rich Summary Templates (2-3 days)

#### 2.1 Create Summary Templates by Thread Class
- [ ] Core threads: Preserve full detail, highlight constraints
- [ ] Active threads: 2-3 sentence overview + current status
- [ ] Complete threads: Detailed summary with conclusions
- [ ] Ephemeral threads: Brief one-liner

```typescript
const SUMMARY_PROMPTS = {
  core: `Summarize this system/developer thread. Focus on:
    - Key constraints and rules
    - Important configuration
    - Must preserve: {specific_terms}`,
    
  active: `Summarize this active discussion. Include:
    - Current topic and progress (2-3 sentences)
    - Key decisions made
    - Next steps or open questions`,
    
  complete: `Summarize this completed thread. Include:
    - What was discussed/accomplished (2-3 sentences)
    - Key insights or conclusions
    - Final outcome or resolution`,
    
  ephemeral: `Brief summary (1 sentence) of this casual exchange.`
};
```

#### 2.2 Implement Progressive Summarization
- [ ] Initial summary at 5 messages
- [ ] Enhanced summary at 10 messages
- [ ] Final summary when thread completes
- [ ] Preserve key points across re-summarizations

#### 2.3 Add Metadata Extraction
- [ ] Extract key terms/entities
- [ ] Identify decisions and action items
- [ ] Tag technical concepts
- [ ] Mark important message IDs

### 📊 Phase 3: Performance & Integration (1-2 days)

#### 3.1 Optimize LLM Usage
- [ ] Use cheaper models for initial summaries
- [ ] Use better models for final summaries
- [ ] Implement caching for unchanged threads
- [ ] Add rate limiting for API calls

```typescript
const MODEL_BY_PRIORITY = {
  initial: 'mini',      // Fast, cheap
  update: 'summary',    // Balanced
  final: 'reasoning'    // High quality
};
```

#### 3.2 Add Monitoring & Metrics
- [ ] Track summarization latency
- [ ] Monitor summary quality scores
- [ ] Log token usage by thread type
- [ ] Create summarization dashboard

#### 3.3 UI Integration Prep
- [ ] Add summary versioning
- [ ] Create summary diff tracking
- [ ] Export UI-ready summary format
- [ ] Add real-time summary updates

### 🧪 Phase 4: Testing & Refinement (1-2 days)

#### 4.1 Create Test Suite
- [ ] Unit tests for queue system
- [ ] Integration tests for triggers
- [ ] Quality tests for summaries
- [ ] Performance benchmarks

#### 4.2 Add Examples
- [ ] Demo with technical discussion
- [ ] Demo with multi-topic conversation
- [ ] Demo with long-running agent
- [ ] Demo with UI visualization

## Quick Start Implementation

### Today's Focus:
1. Create basic summarization queue
2. Add 5-message trigger to processor
3. Connect existing ThreadSummarizer
4. Test with visual demo

### Code to Add:

```typescript
// In processor.ts
private async checkSummarizationTriggers(
  thread: Thread,
  state: MetamemoryState
): Promise<void> {
  // Check various triggers
  const shouldSummarize = 
    (thread.messages.length === 5 && !thread.summary) ||
    (thread.messages.length > 5 && !thread.lastSummarizedAt) ||
    (thread.status === 'complete' && !thread.finalSummary) ||
    (Date.now() - (thread.lastSummarizedAt || 0) > 300000); // 5 min
    
  if (shouldSummarize) {
    console.log(`[Metamemory] Triggering summarization for thread ${thread.id}`);
    this.queueSummarization(thread.id);
  }
}
```

## Benefits of Unified Approach

1. **Efficiency**: One LLM call generates high-quality summary at the right time
2. **Consistency**: Same quality standards throughout conversation
3. **Performance**: Summaries ready when needed, not generated on-demand
4. **Scalability**: Background processing doesn't block main conversation
5. **User Experience**: Real-time summary updates in UI

## Success Metrics

- Summarization triggers within 100ms of conditions being met
- High-quality summaries (2-3 informative sentences) for all thread types
- <2s latency for summary generation
- 90%+ summary accuracy based on thread content
- No impact on main conversation flow

## Next Steps

1. Implement basic queue system (30 min)
2. Add triggers to processor (30 min)
3. Test with existing demos (30 min)
4. Iterate on summary quality (ongoing)