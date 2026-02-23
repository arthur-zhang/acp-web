import { ChatPanel } from './components/ChatPanel'
import { DebugPanel } from './components/DebugPanel'
import { useWebSocket } from './hooks/useWebSocket'

export default function App() {
  const {
    status,
    initialized,
    sessionId,
    rawMessages,
    chatMessages,
    agentState,
    modeOptions,
    selectedModeId,
    modelOptions,
    selectedModelId,
    autoNewSessionEnabled,
    recentSessionIds,
    isLoadingSession,
    roundMetricsByPromptId,
    connect,
    disconnect,
    initialize,
    createSession,
    loadSession,
    resumeSession,
    setAutoNewSession,
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
          sessionId={sessionId}
          messages={chatMessages}
          agentState={agentState}
          onSendPrompt={sendPrompt}
          modeOptions={modeOptions}
          selectedModeId={selectedModeId}
          modelOptions={modelOptions}
          selectedModelId={selectedModelId}
          roundMetricsByPromptId={roundMetricsByPromptId}
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
        <DebugPanel
          status={status}
          initialized={initialized}
          sessionId={sessionId}
          autoNewSessionEnabled={autoNewSessionEnabled}
          recentSessionIds={recentSessionIds}
          isLoadingSession={isLoadingSession}
          messages={rawMessages}
          onConnect={connect}
          onDisconnect={disconnect}
          onInitialize={initialize}
          onCreateSession={createSession}
          onLoadSession={loadSession}
          onResumeSession={resumeSession}
          onToggleAutoNewSession={setAutoNewSession}
          onClear={clearMessages}
        />
      </div>
    </div>
  )
}
