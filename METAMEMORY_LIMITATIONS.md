# Metamemory System Limitations

## Current State

The metamemory system is architecturally complete and functional, but has some important limitations:

### 1. Background Processing Timing
- Metamemory processes messages in the background (non-blocking)
- The `finalState` returned by `task_complete` is a snapshot
- Background metamemory updates after task completion aren't reflected in `finalState`
- This is why compaction often shows "[X unthreaded messages]"

### 2. Message ID Requirements
- Only messages with IDs are tracked by metamemory
- System messages created by ensemble don't have IDs by default
- User messages now get IDs automatically (fixed)
- Assistant messages get IDs from the LLM provider

### 3. Processing Delays
- Metamemory uses the `summary` model class which can be slower
- Processing happens every N messages (configurable via `processInterval`)
- Thread summarization happens after 5+ messages or timeout
- Full processing may not complete before task ends

## Why You See "[13 unthreaded messages]"

This happens because:
1. The task completes before metamemory finishes processing
2. Messages without thread assignments are grouped as "unthreaded"
3. The compactor runs on the state at task completion time

## Workarounds

### 1. Add Processing Delays
```javascript
// Wait after task completion for metamemory to finish
await new Promise(resolve => setTimeout(resolve, 10000));
```

### 2. Use Synchronous Processing (Not Recommended)
Would require reverting the non-blocking changes, which would slow down conversations.

### 3. Access Live State (Not Currently Exposed)
The live `taskLocalState` has the updated metamemory, but it's not accessible after task completion.

## Future Improvements Needed

1. **Persistent State**: Store metamemory state outside the task lifecycle
2. **Completion Callbacks**: Notify when background processing completes
3. **State Syncing**: Sync background updates to accessible state
4. **Faster Processing**: Use dedicated fast models for metamemory
5. **Pre-processing**: Process historical messages before task starts

## Current Best Practices

1. **Longer Conversations**: Metamemory works better with longer conversations where processing has time to complete
2. **Explicit Waits**: Add delays before checking metamemory state
3. **Lower Process Intervals**: Set `processInterval: 1` for more frequent processing
4. **Monitor Background**: Check `metamemoryProcessing` flag to know when it's working

The system is functional but needs architectural improvements to make the background processing results more accessible.