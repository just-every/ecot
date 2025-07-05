import { MessageData, ToolCallData } from '@just-every/demo-ui';
import { Message, ThinkingState, ToolCall, Thread } from '../types';

export function convertMessageToMessageData(message: Message, threadInfo?: Thread): MessageData {
  // Filter out system messages as demo-ui doesn't support them
  if (message.role === 'system') {
    return null as any; // Will be filtered out
  }

  const messageData: MessageData = {
    role: message.role as 'user' | 'assistant',
    content: message.content,
    timestamp: message.timestamp,
    threadId: message.threadId,
    threadName: threadInfo?.name,
    threadType: threadInfo?.type
  };

  return messageData;
}

export function convertThinkingStateToMessageData(thinking: ThinkingState, threadInfo?: Thread): MessageData {
  const messageData: MessageData = {
    role: 'assistant',
    content: '', // Empty content since thinking goes in thinking_content
    thinking_content: thinking.content,
    timestamp: thinking.timestamp,
    threadId: thinking.threadId,
    threadName: threadInfo?.name,
    threadType: threadInfo?.type
  };

  return messageData;
}

export function convertToolCallToToolCallData(toolCall: ToolCall): ToolCallData {
  // Parse arguments if they're a string
  let args = {};
  try {
    args = typeof toolCall.arguments === 'string' 
      ? JSON.parse(toolCall.arguments) 
      : toolCall.arguments;
  } catch (e) {
    args = { raw: toolCall.arguments };
  }

  return {
    id: toolCall.id,
    function: {
      name: toolCall.name,
      arguments: JSON.stringify(args)
    },
    result: toolCall.result ? {
      output: toolCall.result,
      error: undefined
    } : undefined
  };
}

export function convertToolCallToMessageData(toolCall: ToolCall, threadInfo?: Thread): MessageData {
  const toolCallData = convertToolCallToToolCallData(toolCall);
  
  const messageData: MessageData = {
    role: 'assistant',
    content: '', // Tool calls don't have direct content
    tools: [toolCallData],
    timestamp: toolCall.timestamp,
    threadId: toolCall.threadId,
    threadName: threadInfo?.name,
    threadType: threadInfo?.type
  };

  return messageData;
}

export interface ConversationItem {
  type: 'message' | 'thinking' | 'toolCall';
  data: Message | ThinkingState | ToolCall;
  threadInfo?: Thread;
}

export function prepareConversationData(
  messages: Message[],
  thinkingStates: ThinkingState[],
  toolCalls: ToolCall[],
  threads: Thread[]
): MessageData[] {
  // Create a map of thread IDs to thread info
  const threadMap = new Map<string, Thread>();
  threads.forEach(thread => {
    threadMap.set(thread.id, thread);
  });

  // Combine all items with their types
  const allItems: ConversationItem[] = [
    ...messages.map(msg => ({ type: 'message' as const, data: msg })),
    ...thinkingStates.map(think => ({ type: 'thinking' as const, data: think })),
    ...toolCalls.map(tool => ({ type: 'toolCall' as const, data: tool }))
  ];

  // Sort by timestamp
  allItems.sort((a, b) => a.data.timestamp - b.data.timestamp);

  // Convert to MessageData
  const messageDataList: MessageData[] = [];
  
  for (const item of allItems) {
    const threadInfo = item.data.threadId ? threadMap.get(item.data.threadId) : undefined;
    
    let messageData: MessageData | null = null;
    
    switch (item.type) {
      case 'message':
        messageData = convertMessageToMessageData(item.data as Message, threadInfo);
        break;
      case 'thinking':
        messageData = convertThinkingStateToMessageData(item.data as ThinkingState, threadInfo);
        break;
      case 'toolCall':
        messageData = convertToolCallToMessageData(item.data as ToolCall, threadInfo);
        break;
    }
    
    if (messageData && (messageData.role === 'user' || messageData.role === 'assistant')) {
      messageDataList.push(messageData);
    }
  }

  return messageDataList;
}

// Helper to merge consecutive items from the same thread/role into single messages
export function mergeConsecutiveMessages(messages: MessageData[]): MessageData[] {
  if (messages.length === 0) return [];

  const merged: MessageData[] = [];
  let current = { ...messages[0] };

  for (let i = 1; i < messages.length; i++) {
    const msg = messages[i];
    
    // Check if we can merge with current
    if (
      msg.role === current.role &&
      msg.threadId === current.threadId &&
      !msg.tools && !current.tools && // Don't merge messages with tools
      !msg.thinking_content && !current.thinking_content // Don't merge thinking states
    ) {
      // Merge content
      current.content = current.content + '\n\n' + msg.content;
    } else {
      // Can't merge, push current and start new
      merged.push(current);
      current = { ...msg };
    }
  }
  
  // Don't forget the last one
  merged.push(current);
  
  return merged;
}