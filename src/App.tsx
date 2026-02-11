import { ChatPanel } from './components/ChatPanel'
import { DebugPanel } from './components/DebugPanel'
import { useWebSocket } from './hooks/useWebSocket'

export default function App() {
  const {
    status,
    sessionId,
    rawMessages,
    chatMessages,
    agentState,
    modeOptions,
    selectedModeId,
    modelOptions,
    selectedModelId,
    sendPrompt,
    setMode,
    setModel,
    interrupt,
    clearMessages,
    respondToPermission,
    respondToAskUserQuestion,
  } = useWebSocket()

  return (
    <div className="h-screen flex bg-gray-950">
      {/* Left Panel - Chat */}
      <div className="w-1/2 min-w-0">
        <ChatPanel
          status={status}
          sessionId={sessionId}
          messages={chatMessages}
          agentState={agentState}
          onSendPrompt={sendPrompt}
          modeOptions={modeOptions}
          selectedModeId={selectedModeId}
          modelOptions={modelOptions}
          selectedModelId={selectedModelId}
          onSelectMode={setMode}
          onSelectModel={setModel}
          onRespondPermission={respondToPermission}
          onRespondAskUserQuestion={respondToAskUserQuestion}
          onInterrupt={interrupt}
        />
      </div>

      <div className="w-px bg-gray-800 flex-shrink-0" />

      {/* Right Panel - Debug */}
      <div className="w-1/2 min-w-0">
        <DebugPanel messages={rawMessages} onClear={clearMessages} />
      </div>
    </div>
  )
}
