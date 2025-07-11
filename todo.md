Add lines for the new topics with their description. Which starts the MemoryGraph





For class Metamemory in /Users/zemaj/www/just-every/task/src/metamemory/index.ts please add a checkCompact(messages).

This should do the following.
1. For each topicTags:
- Go through and create a target compaction value for each of topicTags (e.g. 0%, 30%, 50%, 100%).
- Base this on it's importance level (type), how recently it was last updated (last_update)
- Save it to target_compaction on the topicTag (0-100)
- This should be a deterministic process (i.e. based on hurstics and not require an LLM call)

2. Once we have the target_compaction we should go through each of the topics and check if we have that compaction available
- Create a topicCompaction map in Metamemory
- Each  topicCompaction should map the topic_tag to an array of objects of the form {
    compacted_messages: number; // The number of messages compacted in the summary
    compacted_tokens: number; // The number of tokens compacted in the summary (i.e. tokens in compacted messages)
    compact_last_id: string; // The id of the last message compacted
    summary: string; // The compacted summary of the messages
}
For each of topicTags, we should check the topicCompaction for that tag. We should generate a new compaction if:
- The tokens for the topic are over a given limit (say 100 tokens/400 chars), or the last message on the topic is more than 100 seconds ago
- And if we don't have a topicCompaction where compacted percent (compacted_tokens/total tokens in messages with topic tag). At a +-10% buffer for the check.
When performing the compaction, include target_compaction+10% tokens (round up to include full messages).
- Handle edge cases for target_compaction, so 0% never generate a compaction. If the compaction tokens is less than 100 tokens (or less than 100 tokens different) from last compaction don't generate. For 100% generate a full compaction.

checkCompact(messages) should be called in /Users/zemaj/www/just-every/task/src/core/engine.ts every time memoryPromise completes. Only one should run at a time (with a timeout like for metamemory.processMessages)

3. Then finally add a compact(messages). 
- Go through topicTags and look for target_compaction. 
- If > 0% then find the largest topicCompaction less than target_compaction + 10%;
- Replace messages with the summary from the compaction. Summary should be a developer message at the same point where the first compacted message would have been in the history.
- Figure out how to handle mulitple tags for a message - handling it would depend on the type of the tag. i.e for core etc.. would retain even if another tag compacts. If other tag is the same level then can compact.
- Return the compacted messages

compact(messages) should be called in /Users/zemaj/www/just-every/task/src/core/engine.ts before every ensembleRequest. At the start, not compaction will happen since there's no topicTags with target_compaction, but over time it will kick in to increase the reduction in message numbers.