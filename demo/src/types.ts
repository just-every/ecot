export interface TaskState {
  status: 'idle' | 'running' | 'completed' | 'error'
  error?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  threadId?: string
  timestamp: number
  metadata?: Record<string, any>
}

export interface Thread {
  id: string
  name: string
  type: 'main' | 'metamemory' | 'metacognition'
  messages: string[]
  metadata?: {
    overlap?: string[]
    triggerReason?: string
    tags?: string[]
    lastUpdate?: string
    lastCheck?: string
    adjustments?: string[]
    summary?: string
    lastActive?: string
  }
}

export interface ThinkingState {
  id: string
  content: string
  timestamp: number
  threadId?: string
  type?: 'reasoning' | 'planning' | 'reflection'
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, any>
  result?: any
  timestamp: number
  threadId?: string
  duration?: number
}

export interface MetaAnalysis {
  threads: MetamemoryThread[]
  metacognition: MetacognitionAnalysis[]
  summary: {
    totalThreads: number
    totalMessages: number
    avgOverlap: number
    mostActiveThread: string
  }
}

export interface MetamemoryThread {
  id: string
  name: string
  size: number
  overlap: Set<string>
  messages: Message[]
}

export interface MetacognitionAnalysis {
  id: string
  trigger: string
  reasoning: string
  decision: string
  impact: string
  timestamp: number
}

// This should match the LLMRequestData type from demo-ui
export interface LLMRequest {
  requestId: string
  agentId: string
  providerName: string
  model: string
  timestamp: Date
  requestData: unknown
  responseData?: unknown
  errorData?: unknown
  status: 'running' | 'complete' | 'error'
  duration?: number
}