import { Conversation, TypingIndicator } from '@just-every/demo-ui'
import { TaskState } from '../types'
import { prepareConversationData } from '../utils/conversationAdapter'
import './ConversationView.scss'

interface ConversationViewProps {
  taskState: TaskState
  isCompactView: boolean
}

export default function ConversationView({ taskState, isCompactView }: ConversationViewProps) {
  // Convert task demo data to demo-ui MessageData format
  const messageData = prepareConversationData(
    taskState.messages,
    taskState.thinking,
    taskState.toolCalls,
    taskState.threads
  );

  return (
    <div className="conversation-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Conversation
        messages={messageData}
        isStreaming={taskState.status === 'running'}
        showAvatars={true}
        showMetadata={!isCompactView}
        showTimestamps={!isCompactView}
        showModels={false}
        showTools={!isCompactView}
        showThinking={!isCompactView}
        showThreadInfo={!isCompactView}
        isCompact={isCompactView}
        autoScroll={true}
        maxHeight="100%"
        emptyMessage="No messages yet. Run a task to start the conversation."
        className="task-conversation"
      />
      {taskState.status === 'running' && messageData.length === 0 && (
        <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
          <TypingIndicator />
        </div>
      )}
    </div>
  )
}