import { useState, useCallback, useRef } from 'react'
import useWebSocket, { ReadyState } from 'react-use-websocket'
import { useTaskEventProcessors } from '@just-every/demo-ui'
import { TaskState } from '../types'

interface UseTaskRunnerProps {
    onStateUpdate: (state: TaskState) => void
}

export function useTaskRunner({ onStateUpdate }: UseTaskRunnerProps) {
    const useServer = import.meta.env.VITE_USE_SERVER === 'true'
    const [socketUrl, setSocketUrl] = useState<string | null>(null)
    const currentStateRef = useRef<TaskState>({
        status: 'idle'
    })

    const { processEvent, reset, llmRequests, messages, requestAgents, totalCost, totalTokens, memoryData, cognitionData, taskProcessor } = useTaskEventProcessors();

    const { addUserMessage } = taskProcessor;

    const { sendMessage, readyState } = useWebSocket(socketUrl, {
        onMessage: (event) => {
            try {
                const data = JSON.parse(event.data)

                // Process the event with the new processor
                processEvent(data)

                // Handle additional task-specific events
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
        if (data.type && !['message_delta', 'tool_delta'].includes(data.type)) {
            console.log('[useTaskRunner] Websocket message:', data.type, data)
        }

        // Handle task-specific events not covered by the processor
        switch (data.type) {
            // Task completion events
            case 'task_complete':
                updateState({ status: 'completed' })
                // Don't close the connection yet - wait for async operations like metamemory
                // The server will close the connection when everything is done
                break

            case 'task_fatal_error':
                updateState({ status: 'error', error: data.result || 'Task failed' })
                // Don't close the connection yet - wait for async operations
                break

            case 'all_events_complete':
                // Now it's safe to close the connection
                console.log('[useTaskRunner] All events received, closing connection')
                setSocketUrl(null)
                break
        }
    }, [updateState])

    const runTask = useCallback(async (prompt: string, taskOptions?: {
        metaFrequency?: string;
        metamemoryEnabled?: boolean;
    }) => {
        // Reset the processor for a new task
        reset()

        // Don't clear messages - let the processor handle them
        updateState({
            status: 'running',
        })

        addUserMessage(prompt)

        if (useServer) {
            // Build URL with options
            const params = new URLSearchParams({
                prompt: prompt,
                ...(taskOptions?.metaFrequency && { metaFrequency: taskOptions.metaFrequency }),
                ...(taskOptions?.metamemoryEnabled !== undefined && { metamemoryEnabled: String(taskOptions.metamemoryEnabled) })
            })
            const wsUrl = `ws://localhost:3020/ws?${params.toString()}`
            setSocketUrl(wsUrl)
        } else {
            // For now, we require the server to be running
            updateState({
                status: 'error',
                error: 'Demo requires the WebSocket server. Please run "npm run demo" from the project root.'
            })
        }
    }, [onStateUpdate, useServer, updateState, reset])

    const stopTask = useCallback(() => {
        if (useServer) {
            if (readyState === ReadyState.OPEN) {
                sendMessage(JSON.stringify({ type: 'stop' }))
            }
            setSocketUrl(null)
        }
        updateState({ status: 'completed' })
    }, [readyState, sendMessage, updateState, useServer])

    return {
        runTask,
        stopTask,
        llmRequests,
        messages,
        requestAgents,
        totalCost,
        totalTokens,
        memoryData,
        cognitionData,
        taskProcessor,
    }
}
