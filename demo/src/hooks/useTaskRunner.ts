import { useState, useCallback, useRef } from 'react'
import useWebSocket, { ReadyState } from 'react-use-websocket'
import { TaskState, LLMRequest, MetaAnalysis, Thread } from '../types'

interface UseTaskRunnerProps {
  onStateUpdate: (state: TaskState) => void
  onLLMRequest: (request: LLMRequest) => void
  onMetaAnalysis: (analysis: MetaAnalysis) => void
}

export function useTaskRunner({ onStateUpdate, onLLMRequest, onMetaAnalysis }: UseTaskRunnerProps) {
  const [socketUrl, setSocketUrl] = useState<string | null>(null)
  const currentStateRef = useRef<TaskState>({
    messages: [],
    threads: [],
    thinking: [],
    toolCalls: [],
    status: 'idle'
  })
  const llmRequestsRef = useRef<Map<string, LLMRequest>>(new Map())

  const { sendMessage, readyState } = useWebSocket(socketUrl, {
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data)
        handleWebSocketMessage(data)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    },
    onError: (error) => {
      console.error('WebSocket error:', error)
      updateState({ status: 'error', error: 'WebSocket connection failed' })
    },
    shouldReconnect: () => false,
  })

  const updateState = useCallback((updates: Partial<TaskState>) => {
    const newState = { ...currentStateRef.current, ...updates }
    currentStateRef.current = newState
    onStateUpdate(newState)
  }, [onStateUpdate])

  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'message':
        updateState({
          messages: [...currentStateRef.current.messages, {
            id: data.id || crypto.randomUUID(),
            role: data.role,
            content: data.content,
            threadId: data.threadId,
            timestamp: Date.now(),
            metadata: data.metadata
          }]
        })
        break

      case 'thread':
        const thread: Thread = {
          id: data.id,
          name: data.name,
          type: data.threadType || data.type || 'main',
          messages: data.messages || [],
          metadata: data.metadata
        }
        updateState({
          threads: [...currentStateRef.current.threads.filter(t => t.id !== thread.id), thread]
        })
        break

      case 'thinking':
        updateState({
          thinking: [...currentStateRef.current.thinking, {
            id: crypto.randomUUID(),
            content: data.content,
            timestamp: Date.now(),
            threadId: data.threadId,
            type: data.thinkingType || data.type || 'reasoning'
          }]
        })
        break

      case 'tool_call':
        updateState({
          toolCalls: [...currentStateRef.current.toolCalls, {
            id: data.id || crypto.randomUUID(),
            name: data.name,
            arguments: data.arguments,
            timestamp: Date.now(),
            threadId: data.threadId
          }]
        })
        break

      case 'tool_result':
        updateState({
          toolCalls: currentStateRef.current.toolCalls.map(tc =>
            tc.id === data.toolId
              ? { ...tc, result: data.result, duration: data.duration }
              : tc
          )
        })
        break

      case 'llm_request':
        const request: LLMRequest = {
          id: data.id,
          model: data.model,
          messages: data.messages,
          temperature: data.temperature,
          maxTokens: data.maxTokens,
          timestamp: data.timestamp || Date.now()
        }
        llmRequestsRef.current.set(data.id, request)
        onLLMRequest(request)
        break

      case 'llm_response':
        if (data.requestId && llmRequestsRef.current.has(data.requestId)) {
          // Update the existing request with response data
          const existingRequest = llmRequestsRef.current.get(data.requestId)!
          const updatedRequest: LLMRequest = {
            ...existingRequest,
            response: {
              content: data.content,
              usage: data.usage
            },
            duration: data.duration
          }
          llmRequestsRef.current.set(data.requestId, updatedRequest)
          onLLMRequest(updatedRequest)
        }
        break

      case 'meta_analysis':
        onMetaAnalysis(data.analysis)
        break

      case 'status':
        updateState({ status: data.status })
        if (data.status === 'completed' || data.status === 'error') {
          setSocketUrl(null)
        }
        break

      case 'error':
        updateState({ status: 'error', error: data.message })
        setSocketUrl(null)
        break
    }
  }, [updateState, onLLMRequest, onMetaAnalysis])

  const runTask = useCallback(async (prompt: string) => {
    // Clear previous state and LLM requests
    llmRequestsRef.current.clear()
    currentStateRef.current = {
      messages: [],
      threads: [],
      thinking: [],
      toolCalls: [],
      status: 'running'
    }
    onStateUpdate(currentStateRef.current)

    const wsUrl = `ws://localhost:3020/ws?prompt=${encodeURIComponent(prompt)}`
    setSocketUrl(wsUrl)
  }, [onStateUpdate])

  const stopTask = useCallback(() => {
    if (readyState === ReadyState.OPEN) {
      sendMessage(JSON.stringify({ type: 'stop' }))
    }
    setSocketUrl(null)
    updateState({ status: 'completed' })
  }, [readyState, sendMessage, updateState])

  return { runTask, stopTask }
}